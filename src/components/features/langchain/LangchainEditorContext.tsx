import { createContext, useContext, type ReactNode } from 'react';

type LangchainEditorContextValue = {
  readOnly: boolean;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
};

const LangchainEditorContext = createContext<LangchainEditorContextValue | null>(null);

export function LangchainEditorProvider({
  value,
  children,
}: {
  value: LangchainEditorContextValue;
  children: ReactNode;
}) {
  return <LangchainEditorContext.Provider value={value}>{children}</LangchainEditorContext.Provider>;
}

export function useLangchainEditorContext(): LangchainEditorContextValue {
  const ctx = useContext(LangchainEditorContext);
  if (!ctx) {
    throw new Error('useLangchainEditorContext must be used within LangchainEditorProvider');
  }
  return ctx;
}
