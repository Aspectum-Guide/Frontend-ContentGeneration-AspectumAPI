import { useState } from 'react';
import { downloadBatchXlsx } from './batchDownload';
import { downloadTextFile } from './partnerFormat';

// Результат массовой генерации: весь список кодов, чтобы передать партию
// партнёру целиком (раньше показывались только 10 примеров).
export default function CodeBatchResult({ result }) {
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState('');
  const batch = result?.batch;
  const codes = Array.isArray(result?.codes) && result.codes.length ? result.codes : result?.examples || [];
  if (!codes.length) return null;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800">
          {batch ? `Партия «${batch.name}»: ` : 'Сгенерировано кодов: '}
          {batch ? `${result?.count ?? codes.length} шт.` : result?.count ?? codes.length}
        </div>
        <div className="flex gap-2">
          {batch ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  setExportError('');
                  await downloadBatchXlsx(batch.id);
                } catch {
                  setExportError('Не удалось скачать Excel — попробуйте ещё раз из списка партий.');
                }
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Скачать Excel для печати
            </button>
          ) : null}
          <button
            type="button"
            onClick={copyAll}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 hover:bg-gray-100"
          >
            {copied ? 'Скопировано' : 'Скопировать все'}
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(`codes-${new Date().toISOString().slice(0, 10)}.csv`, `﻿Код\n${codes.join('\n')}\n`)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 hover:bg-gray-100"
          >
            Скачать CSV
          </button>
        </div>
      </div>
      {exportError ? <div className="text-xs text-red-600">{exportError}</div> : null}
      <div className="max-h-48 overflow-auto flex flex-wrap gap-2">
        {codes.map((code) => (
          <span key={code} className="font-mono text-xs px-2 py-1 rounded bg-white border border-gray-200">{code}</span>
        ))}
      </div>
    </div>
  );
}
