import { useRef, useState } from "react";
import { fmt, networkShort } from "../format.js";

export default function RecordsInput({ samples, value, onChange }) {
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const setKind = (kind) => onChange({ ...value, kind });
  const takeFile = (file) => file && onChange({ ...value, kind: "file", file });

  return (
    <div className="records">
      <div className="segmented" role="tablist" aria-label="Source of flow records">
        <button type="button" role="tab" aria-selected={value.kind === "sample"} onClick={() => setKind("sample")}>
          Built-in sample
        </button>
        <button type="button" role="tab" aria-selected={value.kind === "file"} onClick={() => setKind("file")}>
          Your CSV file
        </button>
      </div>

      {value.kind === "sample" ? (
        <div className="record-options">
          {samples.map((s) => (
            <label key={s.id} className="record-option" data-selected={s.id === value.sampleId}>
              <input type="radio" name="sample" value={s.id} checked={s.id === value.sampleId} className="visually-hidden"
                     onChange={() => onChange({ ...value, sampleId: s.id })} />
              <span className="record-radio" aria-hidden="true" />
              <span className="record-main">
                <span className="record-name">{networkShort(s.network) || s.file}</span>
                <span className="nd-caption">{fmt(s.flows)} test flows · {s.size_mb} MB</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div
          className={dragging ? "dropzone is-dragging" : "dropzone"}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files[0]); }}
        >
          <input ref={fileInput} id="flow-file" type="file" accept=".csv,text/csv" className="visually-hidden"
                 onChange={(e) => takeFile(e.target.files[0])} />
          <label htmlFor="flow-file" className="dropzone-label">
            {value.file ? (
              <>
                <strong>{value.file.name}</strong>
                <span>{(value.file.size / 1e6).toFixed(2)} MB. Choose another file or drop it here.</span>
              </>
            ) : (
              <>
                <strong>Choose a CSV file</strong>
                <span>or drop it here</span>
              </>
            )}
          </label>
          <p className="nd-caption">
            NetFlow v3 records with a header row. The 41 model inputs are required; IP addresses, ports and start times are
            shown in the alert list when present.
          </p>
        </div>
      )}
    </div>
  );
}
