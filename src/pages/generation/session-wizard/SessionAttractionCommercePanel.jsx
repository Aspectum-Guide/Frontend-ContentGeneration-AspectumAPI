import { useCallback, useEffect, useRef, useState } from 'react';
import { attractionCommerceAPI } from '../../../api/generation';
import { Button, IconButton, Panel, TextInput } from '@aspectum/admin-ui-web';

function CommerceItemRow({ label, isDragging, isDropTarget, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onDelete }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm text-aspectum-text-subtle ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'bg-aspectum-primary-soft' : ''}`}
    >
      <span className="cursor-grab select-none text-aspectum-text-faint" title="Перетащить">⠿</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <IconButton
        label="Удалить"
        type="button"
        onClick={onDelete}
        variant="ghostDanger"
        size="iconXs"
        className="shrink-0"
      >
        ×
      </IconButton>
    </div>
  );
}

export default function SessionAttractionCommercePanel({ sessionId, attractionId }) {
  const [itinerary, setItinerary] = useState([]);
  const [inclusions, setInclusions] = useState([]);
  const [name, setName] = useState('');
  const [included, setIncluded] = useState('');
  const [dragItineraryId, setDragItineraryId] = useState(null);
  const [dropItineraryId, setDropItineraryId] = useState(null);
  const [dragInclusionId, setDragInclusionId] = useState(null);
  const [dropInclusionId, setDropInclusionId] = useState(null);
  const dragItineraryIdRef = useRef(null);
  const dragInclusionIdRef = useRef(null);

  const load = useCallback(async () => {
    if (!sessionId || !attractionId) return;
    const [a, b] = await Promise.all([
      attractionCommerceAPI.listItinerary(sessionId, attractionId),
      attractionCommerceAPI.listInclusions(sessionId, attractionId),
    ]);
    setItinerary(a.data?.results || []);
    setInclusions(b.data?.results || []);
  }, [sessionId, attractionId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const deleteItinerary = async (id) => {
    await attractionCommerceAPI.deleteItinerary(sessionId, attractionId, id);
    load();
  };

  const deleteInclusion = async (id) => {
    await attractionCommerceAPI.deleteInclusion(sessionId, attractionId, id);
    load();
  };

  const reorderItinerary = async (targetId) => {
    const sourceId = dragItineraryIdRef.current;
    setDropItineraryId(null);
    if (!sourceId || sourceId === targetId) return;
    const fromIdx = itinerary.findIndex((x) => x.id === sourceId);
    const toIdx = itinerary.findIndex((x) => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...itinerary];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItinerary(next);
    await Promise.all(next.map((x, i) => attractionCommerceAPI.updateItinerary(sessionId, attractionId, x.id, { index: i })));
    load();
  };

  const reorderInclusions = async (targetId) => {
    const sourceId = dragInclusionIdRef.current;
    setDropInclusionId(null);
    if (!sourceId || sourceId === targetId) return;
    const fromIdx = inclusions.findIndex((x) => x.id === sourceId);
    const toIdx = inclusions.findIndex((x) => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...inclusions];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setInclusions(next);
    await Promise.all(next.map((x, i) => attractionCommerceAPI.updateInclusion(sessionId, attractionId, x.id, { index: i })));
    load();
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel className="p-3">
        <p className="mb-2 text-sm font-semibold">Маршрут гида</p>

        {itinerary.map((x) => (
          <CommerceItemRow
            key={x.id}
            label={x.name?.ru || x.name?.en || 'Без названия'}
            isDragging={dragItineraryId === x.id}
            isDropTarget={dropItineraryId === x.id && dragItineraryId !== x.id}
            onDragStart={(e) => { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; dragItineraryIdRef.current = x.id; setDragItineraryId(x.id); }}
            onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; setDropItineraryId(x.id); }}
            onDragLeave={() => setDropItineraryId((prev) => (prev === x.id ? null : prev))}
            onDrop={(e) => { e.preventDefault(); reorderItinerary(x.id); }}
            onDragEnd={() => { dragItineraryIdRef.current = null; setDragItineraryId(null); setDropItineraryId(null); }}
            onDelete={() => deleteItinerary(x.id)}
          />
        ))}

        <div className="mt-2 flex gap-2">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Новая точка"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            onClick={async () => { if (name.trim()) { await attractionCommerceAPI.addItinerary(sessionId, attractionId, { name: { ru: name } }); setName(''); load(); } }}
            variant="primary"
            size="md"
          >
            +
          </Button>
        </div>
      </Panel>

      <Panel className="p-3">
        <p className="mb-2 text-sm font-semibold">Что включено</p>

        {inclusions.map((x) => (
          <CommerceItemRow
            key={x.id}
            label={`${x.kind === 'included' ? '✓' : '✗'} ${x.text?.ru || x.text?.en || '—'}`}
            isDragging={dragInclusionId === x.id}
            isDropTarget={dropInclusionId === x.id && dragInclusionId !== x.id}
            onDragStart={(e) => { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; dragInclusionIdRef.current = x.id; setDragInclusionId(x.id); }}
            onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; setDropInclusionId(x.id); }}
            onDragLeave={() => setDropInclusionId((prev) => (prev === x.id ? null : prev))}
            onDrop={(e) => { e.preventDefault(); reorderInclusions(x.id); }}
            onDragEnd={() => { dragInclusionIdRef.current = null; setDragInclusionId(null); setDropInclusionId(null); }}
            onDelete={() => deleteInclusion(x.id)}
          />
        ))}

        <div className="mt-2 flex gap-2">
          <TextInput
            value={included}
            onChange={(e) => setIncluded(e.target.value)}
            placeholder="Новый пункт"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            onClick={async () => { if (included.trim()) { await attractionCommerceAPI.addInclusion(sessionId, attractionId, { kind: 'included', text: { ru: included } }); setIncluded(''); load(); } }}
            variant="primary"
            size="md"
          >
            +
          </Button>
        </div>
      </Panel>
    </div>
  );
}
