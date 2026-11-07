Fallback barcode decoder for browsers without BarcodeDetector (iPhone Safari, Firefox).
Place here: zxing.min.js  = @zxing/library 0.21.3 UMD build (npm: @zxing/library@0.21.3, file umd/index.min.js), renamed.
  npm pack @zxing/library@0.21.3 && tar xzf zxing-library-0.21.3.tgz && cp package/umd/index.min.js public/vendor/zxing.min.js
scan.js loads it lazily from /vendor/zxing.min.js only when needed. If missing, the scanner shows a friendly message and typing still works.
