import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { RainbowKitProvider } from "@/src/providers/RainbowKitProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <RainbowKitProvider>
      <div className="min-h-screen">
        <Component {...pageProps} />
      </div>
    </RainbowKitProvider>
  );
}
