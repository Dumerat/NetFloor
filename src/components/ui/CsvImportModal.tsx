"use client";

import { useState, type FC } from "react";
import { X, UploadCloud, AlertTriangle, CheckCircle2, FileText, ArrowRight } from "lucide-react";
import { DryRunResult, IngestionError } from "@/engine/ingestion/types";
import { CablingRow } from "@/engine/ingestion/schemas";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `outlet_name,outlet_port,desk_number,floor_name,rack_name,patch_panel_name,patch_panel_port,cable_category,cable_length_m,switch_name,switch_port,vlan_vid,vlan_name
PRISE-DESK-401,RJ45-1,B401,Étage 4 - Plateau,BAIE-LT4A-01,PP-24P-CAT6A-U24,01,CAT6A,34.5,SW-ACCESS-4A-U22,Gi1/0/1,20,VLAN_CORP_DATA
PRISE-DESK-402,RJ45-1,B402,Étage 4 - Plateau,BAIE-LT4A-01,PP-24P-CAT6A-U24,02,CAT6A,38.0,SW-ACCESS-4A-U22,Gi1/0/2,20,VLAN_CORP_DATA
PRISE-DESK-403,RJ45-1,B403,Étage 4 - Plateau,BAIE-LT4A-01,PP-24P-CAT6A-U24,03,CAT6A,29.2,SW-ACCESS-4A-U22,Gi1/0/3,30,VLAN_VOIP
PRISE-DESK-404,RJ45-1,B404,Étage 4 - Plateau,BAIE-LT4A-01,PP-24P-CAT6A-U24,04,CAT6A,41.0,SW-ACCESS-4A-U22,Gi1/0/4,20,VLAN_CORP_DATA
PRISE-DESK-405,RJ45-1,B405,Étage 4 - Plateau,BAIE-LT4A-01,PP-24P-CAT6A-U24,05,CAT6A,42.5,SW-ACCESS-4A-U22,Gi1/0/5,30,VLAN_VOIP`;

export const CsvImportModal: FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [csvContent, setCsvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunResult<CablingRow> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAudit = async () => {
    if (!csvContent.trim()) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/cabling/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, dryRunOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de validation");

      setDryRun(data.dryRun);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/cabling/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, dryRunOnly: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'insertion";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">Ingestion de Carnet de Câblage (CSV)</h3>
              <p className="text-[11px] text-slate-400">Validation Zod stricte et détection d&apos;anomalies physiques</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-medium text-slate-300">Contenu CSV brut</label>
              <button
                type="button"
                onClick={() => setCsvContent(SAMPLE_CSV)}
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-mono"
              >
                <FileText className="w-3 h-3" /> Charger exemple de test
              </button>
            </div>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Collez ici le carnet de câblage..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2 font-mono text-[11px]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dry-Run Results */}
          {dryRun && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Bilan d&apos;Audit Dry-Run :</span>
                  {dryRun.isValid ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CARNET 100% VALIDE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {dryRun.errors.length} ANOMALIES DÉTECTÉES
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-2 border-t border-slate-800/80 text-slate-400">
                  <div>Lignes valides : <span className="text-slate-200 font-semibold">{dryRun.summary.validRows}/{dryRun.summary.totalRows}</span></div>
                  <div>Baies cibles : <span className="text-slate-200 font-semibold">{dryRun.summary.distinctRacks}</span></div>
                  <div>VLANs résolus : <span className="text-slate-200 font-semibold">{dryRun.summary.distinctVlans}</span></div>
                </div>
              </div>

              {/* Erreurs éventuelles */}
              {dryRun.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                  {dryRun.errors.map((err: IngestionError, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-red-500/5 border border-red-500/20 text-red-400">
                      <span className="font-bold">[Ligne {err.row}]</span> [{err.code}] : {err.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
          >
            Fermer
          </button>

          {!dryRun?.isValid ? (
            <button
              type="button"
              disabled={loading || !csvContent.trim()}
              onClick={handleAudit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              {loading ? "Audit en cours..." : "Lancer Audit (Dry-Run)"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleCommit}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              {loading ? "Insertion atomique..." : "Confirmer & Importer en Base"}
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
