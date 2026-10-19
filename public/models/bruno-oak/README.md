# Bruno Simon oak tree

Source: https://github.com/brunosimon/folio-2025
Revision: 41046b57eeed8d156d9c3fd7fa259900baef7816
Copyright (c) 2025 Bruno Simon. MIT license: ../../licenses/bruno-simon-folio-2025.txt

- oakTreesVisual.glb: original static/oakTrees/oakTreesVisual.glb.
- oak-tree.glb: same model decoded from Draco with glTF Transform; original geometry, UVs and six foliage-anchor transforms retained. No runtime decoder download required.
- foliageSDF.png: original static/foliage/foliageSDF.png, sampled as linear mask data.
- palette.png: original static/palette.png, sampled as sRGB with nearest filtering.

BrunoTreeGeometry.js adapts sources/Game/World/Foliage.js and Trees.js: 80 cards per authored foliage anchor, spherical placement, outward normals and default-camera-facing cluster transforms. BrunoTree.jsx uses the original oak colors and SDF texture, adapting material lighting and wind timing to this application's renderer. Original authored oak body geometry is used directly; foliage anchor meshes are replaced with cards as in the source portfolio.
