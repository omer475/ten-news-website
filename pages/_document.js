import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Theme anti-flash: resolve System/Light/Dark BEFORE first paint so the
            page background never flashes the wrong color on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tn_theme');if(!t){var l=localStorage.getItem('tn_dark_mode');t=l===null?'system':(l==='1'?'dark':'light');}var dark=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var d=document.documentElement;d.style.backgroundColor=dark?'#000000':'#ffffff';d.style.colorScheme=dark?'dark':'light';}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* Scribble display face for expressive moments (personalization headings,
            pull-quotes). Caveat is the working stand-in for "Imperfetto"; to swap
            in the real font, drop its @font-face and repoint --font-scribble. */}
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}



