"use client";

import dynamic from "next/dynamic";

const TrendChart = dynamic(() => import("@/components/trend-chart"), { ssr: false });

type Props = { partyName: string };

export default function PartidoClient({ partyName }: Props) {
  return <TrendChart partyName={partyName} />;
}
