import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// School-generated PDFs can omit ToUnicode and rely on Adobe-Korea1 character maps.
// Bundle the library's maps locally; never fetch student data or fonts from a CDN.
const cmapAssets = import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const fontAssets = import.meta.glob('/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
class LocalPdfDataReader {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const url = kind === 'cMapUrl' ? cmapAssets[`/node_modules/pdfjs-dist/cmaps/${filename}`]
      : kind === 'standardFontDataUrl' ? fontAssets[`/node_modules/pdfjs-dist/standard_fonts/${filename}`] : null;
    if (!url) throw new Error('이 PDF의 문자 매핑을 지원하지 않습니다.');
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF 문자 매핑을 읽지 못했습니다.');
    return new Uint8Array(await response.arrayBuffer());
  }
}

/** Reconstruct rows by PDF coordinates rather than depending on content stream ordering. */
export async function extractPdfText(file: File): Promise<string> {
  if (!/\.pdf$/i.test(file.name)) throw new Error('PDF 파일을 선택해 주세요.');
  if (file.size > 20_000_000) throw new Error('20MB 이하 PDF만 지원합니다.');
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true,
    BinaryDataFactory: LocalPdfDataReader, useWorkerFetch: false, useWasm: false });
  // Never prompt for or retain PDF passwords.
  task.onPassword = () => { void task.destroy(); };
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error('30페이지 이하 성적표만 지원합니다.');
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const lines: { y: number; items: { x: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        let line = lines.find(entry => Math.abs(entry.y - y) < 2);
        if (!line) { line = { y, items: [] }; lines.push(line); }
        line.items.push({ x: item.transform[4], text: item.str });
      }
      pages.push(lines.sort((a, b) => b.y - a.y).map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).join('\n'));
      page.cleanup();
    }
    return pages.join('\n');
  } catch (error) {
    if (error instanceof Error && /password|destroyed/i.test(error.message)) throw new Error('암호로 보호된 PDF는 지원하지 않습니다. 암호가 없는 성적표를 사용해 주세요.');
    throw error;
  } finally { await task.destroy(); }
}
