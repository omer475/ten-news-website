import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* No webfont: the UI uses the system font (SF Pro on Apple devices) via
            -apple-system. The old Inter load was never referenced and only cost
            a render-blocking round-trip. */}
        <meta name="theme-color" content="#F5F5F7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A0A0C" media="(prefers-color-scheme: dark)" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}



