import React, { useState, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'

type FileSetting = {
  file: File;
  pageInput: string;
  rangeStart: string;
  rangeEnd: string;
  error: string;
  loading: boolean;
};

type WordFileInfo = {
  file: File;
  extractedText: string;
  eightDigitNumber: string | null;
  error: string;
  loading: boolean;
};

const App: React.FC = () => {
  const [fileSettings, setFileSettings] = useState<FileSetting[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<'bulk' | 'individual'>('bulk');
  const [bulkPageInput, setBulkPageInput] = useState("");
  const [bulkRangeStart, setBulkRangeStart] = useState("");
  const [bulkRangeEnd, setBulkRangeEnd] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [showFileList, setShowFileList] = useState(false);
  const [wordFiles, setWordFiles] = useState<WordFileInfo[]>([]);
  const [wordDragActive, setWordDragActive] = useState(false);
  const wordFileInputRef = useRef<HTMLInputElement>(null);

  // 全角→半角変換関数
  const toHalfWidth = (str: string) =>
    str
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[，]/g, ',')
      .replace(/[－ー―‐]/g, '-')
      .replace(/\s+/g, '');

  // 8桁の数字を検索する関数
  const findEightDigitNumber = (text: string): string | null => {
    const normalizedText = toHalfWidth(text);
    const eightDigitRegex = /\b\d{8}\b/g;
    const matches = normalizedText.match(eightDigitRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  };

  // Wordファイルからテキストを抽出して8桁の数字を検索
  const extractTextFromWordFile = async (file: File): Promise<{ text: string; eightDigitNumber: string | null }> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const extractedText = result.value;
      const eightDigitNumber = findEightDigitNumber(extractedText);
      return { text: extractedText, eightDigitNumber };
    } catch (error) {
      throw new Error('Wordファイルの読み込みに失敗しました');
    }
  };

  // ページ指定のパース（例: "1,3,5-7" → [1,3,5,6,7]）
  const parsePages = (input: string) => {
    const normalized = toHalfWidth(input);
    const pages: number[] = [];
    normalized.split(",").forEach((part) => {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const num = Number(part);
        if (!isNaN(num)) {
          pages.push(num);
        }
      }
    });
    return pages;
  };

  // 範囲指定でページ番号リストを作成
  const getRangePages = (rangeStart: string, rangeEnd: string) => {
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
      const arr = [];
      for (let i = start; i <= end; i++) arr.push(i);
      return arr;
    }
    return [];
  };

  // ファイル追加
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newSettings: FileSetting[] = Array.from(files)
      .filter(f => f.type === "application/pdf")
      .map(f => {
        return { file: f, pageInput: "", rangeStart: "", rangeEnd: "", error: "", loading: false };
      });
    setFileSettings(prev => [...prev, ...newSettings]);
  };

  // ドラッグ＆ドロップ
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  // 各ファイルの設定変更
  const updateSetting = (idx: number, changes: Partial<FileSetting>) => {
    setFileSettings(prev => prev.map((s, i) => i === idx ? { ...s, ...changes } : s));
  };

  // ページ番号抽出
  const handleExtract = async (idx: number) => {
    updateSetting(idx, { error: "", loading: true });
    const setting = fileSettings[idx];
    const { file, pageInput } = setting;
    if (!file) {
      updateSetting(idx, { error: "PDFファイルがありません。", loading: false });
      return;
    }
    const pages = parsePages(pageInput);
    if (pages.length === 0) {
      updateSetting(idx, { error: "抽出したいページ番号を入力してください。", loading: false });
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      const totalPages = pdfDoc.getPageCount();
      for (const pageNum of pages) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
        newPdf.addPage(copiedPage);
      }
      const newPdfBytes = await newPdf.save();
      const blob = new Blob([newPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getOutputFileName(setting);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      updateSetting(idx, { loading: false });
    } catch (e) {
      updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
    }
  };

  // 範囲抽出
  const handleExtractRange = async (idx: number) => {
    updateSetting(idx, { error: "", loading: true });
    const setting = fileSettings[idx];
    const { file, rangeStart, rangeEnd } = setting;
    if (!file) {
      updateSetting(idx, { error: "PDFファイルがありません。", loading: false });
      return;
    }
    const pages = getRangePages(rangeStart, rangeEnd);
    if (pages.length === 0) {
      updateSetting(idx, { error: "有効なページ範囲を入力してください。", loading: false });
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      const totalPages = pdfDoc.getPageCount();
      for (const pageNum of pages) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
        newPdf.addPage(copiedPage);
      }
      const newPdfBytes = await newPdf.save();
      const blob = new Blob([newPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getOutputFileName(setting);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      updateSetting(idx, { loading: false });
    } catch (e) {
      updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
    }
  };

  // 最後のページを削除
  const handleRemoveLastPage = async (idx: number) => {
    updateSetting(idx, { error: "", loading: true });
    const setting = fileSettings[idx];
    const { file } = setting;
    if (!file) {
      updateSetting(idx, { error: "PDFファイルがありません。", loading: false });
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();
      if (totalPages <= 1) {
        updateSetting(idx, { error: "1ページしかないPDFは削除できません。", loading: false });
        return;
      }
      const newPdf = await PDFDocument.create();
      const pageIndexes = Array.from({ length: totalPages - 1 }, (_, i) => i);
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndexes);
      copiedPages.forEach((p) => newPdf.addPage(p));
      const newPdfBytes = await newPdf.save();
      const blob = new Blob([newPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getOutputFileName(setting);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      updateSetting(idx, { loading: false });
    } catch (e) {
      updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
    }
  };

  // 一括ページ番号抽出
  const handleBulkExtract = async () => {
    setBulkError("");
    setBulkLoading(true);
    const pages = parsePages(bulkPageInput);
    if (pages.length === 0) {
      setBulkError("抽出したいページ番号を入力してください。");
      setBulkLoading(false);
      return;
    }
    await Promise.all(fileSettings.map(async (setting, idx) => {
      updateSetting(idx, { error: "", loading: true });
      try {
        const arrayBuffer = await setting.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();
        const totalPages = pdfDoc.getPageCount();
        for (const pageNum of pages) {
          if (pageNum < 1 || pageNum > totalPages) continue;
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }
        const newPdfBytes = await newPdf.save();
        const blob = new Blob([newPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getOutputFileName(setting);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        updateSetting(idx, { loading: false });
      } catch (e) {
        updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
      }
    }));
    setBulkLoading(false);
  };

  // 一括範囲抽出
  const handleBulkExtractRange = async () => {
    setBulkError("");
    setBulkLoading(true);
    const pages = getRangePages(bulkRangeStart, bulkRangeEnd);
    if (pages.length === 0) {
      setBulkError("有効なページ範囲を入力してください。");
      setBulkLoading(false);
      return;
    }
    await Promise.all(fileSettings.map(async (setting, idx) => {
      updateSetting(idx, { error: "", loading: true });
      try {
        const arrayBuffer = await setting.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();
        const totalPages = pdfDoc.getPageCount();
        for (const pageNum of pages) {
          if (pageNum < 1 || pageNum > totalPages) continue;
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }
        const newPdfBytes = await newPdf.save();
        const blob = new Blob([newPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getOutputFileName(setting);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        updateSetting(idx, { loading: false });
      } catch (e) {
        updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
      }
    }));
    setBulkLoading(false);
  };

  // 一括最後のページ削除
  const handleBulkRemoveLastPage = async () => {
    setBulkError("");
    setBulkLoading(true);
    await Promise.all(fileSettings.map(async (setting, idx) => {
      updateSetting(idx, { error: "", loading: true });
      try {
        const arrayBuffer = await setting.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();
        if (totalPages <= 1) {
          updateSetting(idx, { error: "1ページしかないPDFは削除できません。", loading: false });
          return;
        }
        const newPdf = await PDFDocument.create();
        const pageIndexes = Array.from({ length: totalPages - 1 }, (_, i) => i);
        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndexes);
        copiedPages.forEach((p) => newPdf.addPage(p));
        const newPdfBytes = await newPdf.save();
        const blob = new Blob([newPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getOutputFileName(setting);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        updateSetting(idx, { loading: false });
      } catch (e) {
        updateSetting(idx, { error: "PDFの処理中にエラーが発生しました。", loading: false });
      }
    }));
    setBulkLoading(false);
  };

  // ファイルリセット
  const handleResetFiles = () => {
    setFileSettings([]);
    setBulkPageInput("");
    setBulkRangeStart("");
    setBulkRangeEnd("");
    setBulkError("");
  };

  // ファイル名決定関数
  const getOutputFileName = (setting: FileSetting) => {
    return setting.file.name.replace(/\.[^.]+$/, ".pdf");
  };

  // 各ファイルのUI
  const renderFileSetting = (setting: FileSetting, idx: number) => (
    <div key={idx} className="app-card" style={{ marginBottom: 32 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{getOutputFileName(setting)}</div>
      <div style={{ marginBottom: 12 }}>
        <label>抽出したいページ番号（例: 1,3,5-7）：<br />
          <input type="text" value={setting.pageInput} onChange={e => updateSetting(idx, { pageInput: toHalfWidth(e.target.value) })} />
        </label>
      </div>
      <div className="range-row">
        <label style={{ flex: 1 }}>ページ範囲で抽出：</label>
        <input type="number" min="1" placeholder="開始" value={setting.rangeStart} onChange={e => updateSetting(idx, { rangeStart: e.target.value })} style={{ width: 80 }} />
        <span>〜</span>
        <input type="number" min="1" placeholder="終了" value={setting.rangeEnd} onChange={e => updateSetting(idx, { rangeEnd: e.target.value })} style={{ width: 80 }} />
      </div>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <button onClick={() => handleExtract(idx)} disabled={setting.loading}>抽出してダウンロード</button>
        <button onClick={() => handleExtractRange(idx)} disabled={setting.loading} style={{ marginLeft: 8 }}>範囲抽出</button>
        <button className="remove-btn" onClick={() => handleRemoveLastPage(idx)} disabled={setting.loading} style={{ marginLeft: 8 }}>最後のページを削除</button>
      </div>
      {setting.error && <div className="error-message">{setting.error}</div>}
    </div>
  );

  // ファイル追加（簡素化版）
  const handleWordFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArr = Array.from(files);
    const newWordFiles: WordFileInfo[] = fileArr.map(f => ({
      file: f,
      extractedText: "",
      eightDigitNumber: null,
      error: "",
      loading: false
    }));
    setWordFiles(prev => [...prev, ...newWordFiles]);
    if (wordFileInputRef.current) wordFileInputRef.current.value = "";
  };

  // Wordファイルを処理して8桁の数字を検索
  const processWordFile = async (index: number) => {
    const wordFile = wordFiles[index];
    if (!wordFile) return;

    setWordFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, loading: true, error: "" } : f
    ));

    try {
      const { text, eightDigitNumber } = await extractTextFromWordFile(wordFile.file);
      setWordFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          extractedText: text, 
          eightDigitNumber, 
          loading: false 
        } : f
      ));
    } catch (error) {
      setWordFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          error: error instanceof Error ? error.message : 'エラーが発生しました', 
          loading: false 
        } : f
      ));
    }
  };

  // 8桁の数字でファイル名を変更してダウンロード
  const downloadWithNewName = (index: number) => {
    const wordFile = wordFiles[index];
    if (!wordFile || !wordFile.eightDigitNumber) {
      alert('8桁の数字が見つかりません');
      return;
    }

    const originalExtension = wordFile.file.name.split('.').pop();
    const newFileName = `${wordFile.eightDigitNumber}.${originalExtension}`;
    
    const url = URL.createObjectURL(wordFile.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = newFileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // 全てのWordファイルを一括処理
  const processAllWordFiles = async () => {
    for (let i = 0; i < wordFiles.length; i++) {
      await processWordFile(i);
    }
  };

  // 全てのファイルを8桁の数字でダウンロード
  const downloadAllWithNewNames = () => {
    const validFiles = wordFiles.filter(f => f.eightDigitNumber);
    if (validFiles.length === 0) {
      alert('8桁の数字が見つかったファイルがありません');
      return;
    }

    validFiles.forEach((wordFile, index) => {
      setTimeout(() => {
        const originalExtension = wordFile.file.name.split('.').pop();
        const newFileName = `${wordFile.eightDigitNumber}.${originalExtension}`;
        
        const url = URL.createObjectURL(wordFile.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = newFileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }, index * 100); // 少しずつ遅延させてダウンロード
    });
  };

  // グローバルでドラッグ＆ドロップのデフォルト挙動を抑制
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', prevent, false);
    window.addEventListener('drop', prevent, false);
    document.addEventListener('dragover', prevent, false);
    document.addEventListener('drop', prevent, false);
    document.body.addEventListener('dragover', prevent, false);
    document.body.addEventListener('drop', prevent, false);
    return () => {
      window.removeEventListener('dragover', prevent, false);
      window.removeEventListener('drop', prevent, false);
      document.removeEventListener('dragover', prevent, false);
      document.removeEventListener('drop', prevent, false);
      document.body.removeEventListener('dragover', prevent, false);
      document.body.removeEventListener('drop', prevent, false);
    };
  }, []);

  return (
    <div>
      <div style={{
        width: '100%',
        background: '#28a745',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 20,
        textAlign: 'center',
        padding: '8px 0',
        letterSpacing: 2,
        zIndex: 2000
      }}>
        修正済み2（グローバルドラッグ＆ドロップ抑制テスト用）
      </div>
      <div className="app-main-row">
        {/* 左カラム：PDF抽出機能 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "0" }}>
            <div style={{ maxWidth: 700, margin: "0 auto 16px auto", display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
              <button onClick={handleResetFiles} style={{ background: '#444', color: '#fff' }}>リセット</button>
              <button onClick={() => setShowFileList(true)} style={{ background: '#6c63ff', color: '#fff' }}>ファイル一覧を表示</button>
            </div>
            {showFileList && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowFileList(false)}>
                <div style={{ background: '#23283a', color: '#fff', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>現在のファイル一覧</div>
                  {fileSettings.length === 0 ? (
                    <div style={{ color: '#bfc7d5' }}>ファイルがありません</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {fileSettings.map((f, i) => (
                        <li key={i} style={{ marginBottom: 8, wordBreak: 'break-all' }}>{f.file.name}</li>
                      ))}
                    </ul>
                  )}
                  <button style={{ marginTop: 24 }} onClick={() => setShowFileList(false)}>閉じる</button>
                </div>
              </div>
            )}
            <div
              className={`drop-area${dragActive ? ' drop-area-active' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('fileInput')?.click()}
              style={{ userSelect: 'none' }}
            >
              {dragActive ? (
                <>
                  <div className="drop-area-icon">📂</div>
                  <div className="drop-area-text">ここにファイルをドロップ！</div>
                  <div className="drop-area-desc">PDFファイルをまとめて追加できます</div>
                </>
              ) : (
                <>
                  <div className="drop-area-text">PDFファイルをドラッグ＆ドロップ</div>
                  <div className="drop-area-desc">または <input id="fileInput" type="file" accept="application/pdf" multiple style={{ display: "inline" }} onChange={e => handleFiles(e.target.files)} /> で追加</div>
                </>
              )}
            </div>
            <div style={{ maxWidth: 600, margin: "0 auto 24px auto", textAlign: "right" }}>
              {mode === 'bulk' ? (
                <button onClick={() => setMode('individual')}>1つずつ選ぶ</button>
              ) : (
                <button onClick={() => setMode('bulk')}>一括モードに戻す</button>
              )}
            </div>
            {mode === 'bulk' && fileSettings.length > 0 && (
              <div className="app-card" style={{ marginBottom: 32 }}>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>一括操作</div>
                <div style={{ marginBottom: 12 }}>
                  <label>抽出したいページ番号（例: 1,3,5-7）：<br />
                    <input type="text" value={bulkPageInput} onChange={e => setBulkPageInput(toHalfWidth(e.target.value))} />
                  </label>
                  <button onClick={handleBulkExtract} disabled={bulkLoading} style={{ marginLeft: 8 }}>一括抽出</button>
                </div>
                <div className="range-row">
                  <label style={{ flex: 1 }}>ページ範囲で一括抽出：</label>
                  <input type="number" min="1" placeholder="開始" value={bulkRangeStart} onChange={e => setBulkRangeStart(e.target.value)} style={{ width: 80 }} />
                  <span>〜</span>
                  <input type="number" min="1" placeholder="終了" value={bulkRangeEnd} onChange={e => setBulkRangeEnd(e.target.value)} style={{ width: 80 }} />
                  <button onClick={handleBulkExtractRange} disabled={bulkLoading} style={{ marginLeft: 8 }}>一括範囲抽出</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button className="remove-btn" onClick={handleBulkRemoveLastPage} disabled={bulkLoading}>全て最後のページを削除</button>
                </div>
                {bulkError && <div className="error-message">{bulkError}</div>}
              </div>
            )}
            {mode === 'individual' && fileSettings.length === 0 && (
              <div className="app-card" style={{ textAlign: "center", color: "#bfc7d5" }}>
                ここにPDFファイルをドラッグ＆ドロップ、または「ファイルを選択」で追加してください。
              </div>
            )}
            {mode === 'individual' && fileSettings.map(renderFileSetting)}
          </div>
        </div>
        {/* 右カラム：ファイル一覧（簡素化版） */}
        <div style={{ flex: 1, minWidth: 0, borderLeft: '1.5px solid #23283a', padding: '0' }}>
          <div className="app-card" style={{ margin: '48px auto', maxWidth: 480 }}>
            <h2>8桁数字検索・ファイル名変換</h2>
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => {
                setWordFiles([]);
              }} style={{ background: '#444', color: '#fff', marginRight: 8 }}>リセット</button>
              <button onClick={processAllWordFiles} disabled={wordFiles.length === 0} style={{ background: '#6c63ff', color: '#fff', marginRight: 8 }}>
                全ファイル処理
              </button>
              <button onClick={downloadAllWithNewNames} disabled={wordFiles.filter(f => f.eightDigitNumber).length === 0} style={{ background: '#28a745', color: '#fff' }}>
                全ファイルダウンロード
              </button>
            </div>
            <div className={`drop-area${wordDragActive ? ' drop-area-active' : ''}`}
              onDrop={e => { e.preventDefault(); setWordDragActive(false); handleWordFiles(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setWordDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setWordDragActive(false); }}
              onClick={() => document.getElementById('wordFileInput')?.click()}
              style={{ userSelect: 'none', marginBottom: 24 }}
            >
              <input id="wordFileInput" ref={wordFileInputRef} type="file" accept=".doc,.docx" multiple style={{ display: "none" }} onChange={async e => { await handleWordFiles(e.target.files); if (e.target) e.target.value = ""; }} />
              {wordDragActive ? (
                <>
                  <div className="drop-area-icon">📄</div>
                  <div className="drop-area-text">ここにWordファイルをドロップ！</div>
                  <div className="drop-area-desc">Wordファイルをまとめて追加できます</div>
                </>
              ) : (
                <>
                  <div className="drop-area-text">Wordファイルをドラッグ＆ドロップ</div>
                  <div className="drop-area-desc">または <span style={{ textDecoration: 'underline', color: '#6c63ff', cursor: 'pointer' }}>ファイルを選択</span> で追加</div>
                </>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              {wordFiles.length === 0 && <div style={{ color: '#bfc7d5' }}>ファイルがありません</div>}
              {wordFiles.length > 0 && (
                <div>
                  {wordFiles.map((wordFile, i) => (
                    <div key={i} style={{ 
                      border: '1px solid #23283a', 
                      borderRadius: 8, 
                      padding: 12, 
                      marginBottom: 12,
                      backgroundColor: '#1a1d2a'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>
                        {wordFile.file.name}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        {wordFile.loading ? (
                          <span style={{ color: '#6c63ff' }}>処理中...</span>
                        ) : wordFile.eightDigitNumber ? (
                          <span style={{ color: '#28a745' }}>
                            見つかった8桁数字: {wordFile.eightDigitNumber}
                          </span>
                        ) : wordFile.extractedText ? (
                          <span style={{ color: '#ffc107' }}>8桁の数字が見つかりませんでした</span>
                        ) : (
                          <span style={{ color: '#bfc7d5' }}>未処理</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => processWordFile(i)} 
                          disabled={wordFile.loading}
                          style={{ 
                            background: '#6c63ff', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: '12px',
                            cursor: wordFile.loading ? 'not-allowed' : 'pointer'
                          }}
                        >
                          処理
                        </button>
                        {wordFile.eightDigitNumber && (
                          <button 
                            onClick={() => downloadWithNewName(i)}
                            style={{ 
                              background: '#28a745', 
                              color: '#fff', 
                              border: 'none', 
                              padding: '4px 8px', 
                              borderRadius: 4, 
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            ダウンロード
                          </button>
                        )}
                      </div>
                      {wordFile.error && (
                        <div style={{ color: '#dc3545', fontSize: '12px', marginTop: 4 }}>
                          {wordFile.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
