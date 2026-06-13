import { useEffect, type MutableRefObject } from 'react';
import { useReactFlow, type ReactFlowInstance, type XYPosition } from '@xyflow/react';

export type FlowCoordsBridge = {
  screenToFlowPosition: (position: XYPosition) => XYPosition;
  getViewport: ReactFlowInstance['getViewport'];
};

/** Syncs live React Flow coordinate helpers for drop handlers outside the flow store subtree. */
export function LangchainFlowCoordsBridge({
  bridgeRef,
}: {
  bridgeRef: MutableRefObject<FlowCoordsBridge | null>;
}) {
  const { screenToFlowPosition, getViewport } = useReactFlow();

  useEffect(() => {
    bridgeRef.current = { screenToFlowPosition, getViewport };
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, screenToFlowPosition, getViewport]);

  return null;
}
