MomentSS HEIF decoding dependency

heic-to 1.6.5 (unmodified npm package), by Hopper Gee
License: GNU Lesser General Public License v3 or later
License text: heic-to-LICENSE.txt in this directory
Source and build instructions: https://github.com/hoppergee/heic-to
Exact distributed package: https://registry.npmjs.org/heic-to/-/heic-to-1.6.5.tgz

heic-to includes libheif 1.23.5 and its HEVC decoder.
libheif source: https://github.com/strukturag/libheif/tree/v1.23.5
libde265 source: https://github.com/strukturag/libde265
Their upstream license notices remain part of the dependency distribution.

MomentSS loads the codec as a separate generated JavaScript chunk via
src/lib/imageImport.ts. To replace it with an interface-compatible build,
replace the dependency and run npm run build. No library source was modified.
