import { codeBatchesAPI } from '../../../api/subscription';
import { downloadBlob } from './partnerFormat';

function filenameFromResponse(response, fallback) {
  const header = response?.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : fallback;
}

// Excel партии: коды, ссылки для QR и что они открывают — для типографии.
export async function downloadBatchXlsx(batchId) {
  const response = await codeBatchesAPI.exportXlsx(batchId);
  downloadBlob(filenameFromResponse(response, `aspectum-cards-${batchId}.xlsx`), response.data);
}
