# Changelog

## [0.4.2](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.4.1...netfloor-architect-v0.4.2) (2026-09-20)


### 🐛 Corrections de bugs

* minor fix, using Number.method instead of method ([4d077e3](https://github.com/Dumerat/NetFloor/commit/4d077e3266efd9e863caa8da164ecf5e870e5b93))

## [0.4.1](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.4.0...netfloor-architect-v0.4.1) (2026-09-20)


### 💄 Style / Formatage

* apply prettier code formatting to all typescript files ([e5710b2](https://github.com/Dumerat/NetFloor/commit/e5710b20231467fed1e6bf348bc6c88699a1fce2))

## [0.4.0](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.3.0...netfloor-architect-v0.4.0) (2026-09-19)


### ✨ Nouvelles fonctionnalités

* **canvas:** interactive group selection envelope and cursor alignment fix ([e8e63a3](https://github.com/Dumerat/NetFloor/commit/e8e63a328e9d2ff6d4aad1b29e739285a671cfa8))


### ⚡ Performances

* **canvas:** lock background plans at 60fps and add smart multi-plan layout ([ff18312](https://github.com/Dumerat/NetFloor/commit/ff1831205f09e175b87a87c466fe7df2ec03285b))


### ♻️ Refactoring

* **ui:** remove floor dimensions preview from top toolbar site button ([49ed7e7](https://github.com/Dumerat/NetFloor/commit/49ed7e7ca8b0c10efe71a44d6b6050e4ebf104c0))
* **ui:** remove obsolete locked plans badge from top toolbar ([1bd749d](https://github.com/Dumerat/NetFloor/commit/1bd749daf4a3a41bcb5a4a0c4950cf32a23eb9e0))

## [0.3.0](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.2.2...netfloor-architect-v0.3.0) (2026-09-17)


### ✨ Nouvelles fonctionnalités

* **docker:** enable 100% containerized zero-dependency execution ([2355a15](https://github.com/Dumerat/NetFloor/commit/2355a15d3a22981a012230dd0c2dd5ee46d03903))
* multi-desk socket blocks, drag-merge outlets, and passive copper inspector ([e89b2b7](https://github.com/Dumerat/NetFloor/commit/e89b2b7fcd3eed3b7642f6b1ce1872e7c021f222))


### 🐛 Corrections de bugs

* auto-migrate db metadata columns, remove mock cloud switches, and add favicon ([48560be](https://github.com/Dumerat/NetFloor/commit/48560be9b4a6b98ea37c6082f5ab7d146f4d798c))
* default --build in docker runners and unassign default vlan from palette generic port ([9826fdf](https://github.com/Dumerat/NetFloor/commit/9826fdf4f73145248e206556f52366fa731647fe))


### ♻️ Refactoring

* project cleanup, move docs to docs/, fix /api 404, and set Docker as default launcher ([5fcf322](https://github.com/Dumerat/NetFloor/commit/5fcf32242f5866ffff8bdb9c3aca9a7368e1140c))


### 📖 Documentation

* add comprehensive README.md and Windows PowerShell launcher run.ps1 ([6f24a95](https://github.com/Dumerat/NetFloor/commit/6f24a959a47f947baf55c8827933ce3e220bec13))
* fix formatting artifacts and backslash escapes in README.md ([e49c291](https://github.com/Dumerat/NetFloor/commit/e49c2918e87b2e9bc4adf9e063a147a3dfb62fea))


### 💄 Style / Formatage

* apply prettier formatting across all src files ([63276f0](https://github.com/Dumerat/NetFloor/commit/63276f0c9df60980a5b284285cde381b754b2f85))

## [0.2.2](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.2.1...netfloor-architect-v0.2.2) (2026-09-14)


### 🐛 Corrections de bugs

* **quality:** fix index.test.ts ([050088a](https://github.com/Dumerat/NetFloor/commit/050088a65375160844c6751d10fc1251ff225414))

## [0.2.1](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.2.0...netfloor-architect-v0.2.1) (2026-09-14)


### 💄 Style / Formatage

* prettier format 3 test files (format:check CI fix) ([deb165d](https://github.com/Dumerat/NetFloor/commit/deb165d09ba816c3068157e549cccdab63e0d40c))


### ✅ Tests

* add unit tests for data layer to meet 80% coverage gate ([a6fdd63](https://github.com/Dumerat/NetFloor/commit/a6fdd637e36ba3e532960416962115f1c046ea47))

## [0.2.0](https://github.com/Dumerat/NetFloor/compare/netfloor-architect-v0.1.0...netfloor-architect-v0.2.0) (2026-09-14)


### ✨ Nouvelles fonctionnalités

* add production docker architecture with caddy minio and backups ([a3c8ed4](https://github.com/Dumerat/NetFloor/commit/a3c8ed4f88229ffa800059ad0affc08d3d964c79))
* **app:** Next.js App Router full-stack UI, React-Konva canvas & multi-outlet cabling topology ([a58d79a](https://github.com/Dumerat/NetFloor/commit/a58d79a011a3b132b9baec954b8dc0360eccaff4))
* blank canvas by default, postgres persistence, demo-config export and launcher auto-db ([3e3f859](https://github.com/Dumerat/NetFloor/commit/3e3f85956f7b50770e79638d1d5549b86d568a1b))
* **cables:** strict 90-degree orthogonal routing with draggable corridor handles and parallel lanes ([1d4de6c](https://github.com/Dumerat/NetFloor/commit/1d4de6c29b52406c1d78427a2a5bbc2ac6857dbb))
* **canvas:** enlarged occupant badges with auto-clipping, interactive 19in racks and CSV export ([ed50a46](https://github.com/Dumerat/NetFloor/commit/ed50a46b4a00b11f97d547cf62666be68845323e))
* **canvas:** socket-to-seat attribution, uncluttered labels, enlarged desk occupants & palette cleanup ([019dede](https://github.com/Dumerat/NetFloor/commit/019dede38f8953576391f74fd2556527ed6d0cbb))
* **db:** implement relational graph model & recursive CTE link tracing ([fd38852](https://github.com/Dumerat/NetFloor/commit/fd38852c0542df415fc2105fc3dce49226ec6544))
* **demo:** add rack-03 and extensive connected desks, outlets, and links ([290cfa8](https://github.com/Dumerat/NetFloor/commit/290cfa88680c8d13d86c3a77a6999ce50ab95a79))
* **desk-cables-rack:** zero latency desk sync, multi-bend 90 deg routing, free glided detachment, and rack internal patching UI ([ff9a49c](https://github.com/Dumerat/NetFloor/commit/ff9a49c80f8e555a028cbc04586a803287f2f7d5))
* **furniture:** multi-seat individual assignment for double and quadruple benches ([f00ef7c](https://github.com/Dumerat/NetFloor/commit/f00ef7c3049ba7e06af6f138484fd6e4e20d31a2))
* **hr:** filtered HR view, Entra ID employee directory, desk description & simplified visual labeling ([ef703a2](https://github.com/Dumerat/NetFloor/commit/ef703a217a469f904d6fdf78fb8ecbb79b9a9d8d))
* **ingestion:** bulk cabling CSV parser, dry-run auditor & atomic importer ([4761fab](https://github.com/Dumerat/NetFloor/commit/4761fabc255030e37ab3f3fc268ff13d06a6eb79))
* **inspector:** port-level hierarchical network patching and furniture layout reorganization ([a0e7e8d](https://github.com/Dumerat/NetFloor/commit/a0e7e8d26fbacac08d814c4ca5034f3fc7a2767a))
* **inventory:** add sidebar inventory panel with users, desks, ports, devices and infrastructure tabs ([b7c5b3e](https://github.com/Dumerat/NetFloor/commit/b7c5b3e2fe131ee0ee376a2bbeafab34cb7ff98e))
* **inventory:** add workstation PC IP and split relais/IP lines to prevent overflow ([9ab4bde](https://github.com/Dumerat/NetFloor/commit/9ab4bde90b69fe74216dead96e003239c4f041f8))
* **inventory:** display port emotes, enable drag-drop user assignment, and realistic object drag previews ([fa598df](https://github.com/Dumerat/NetFloor/commit/fa598df2e56a3dfa18f7508317870040da699891))
* **inventory:** support multiple desks and outlets per user with dedicated IP phone card ([33d7e80](https://github.com/Dumerat/NetFloor/commit/33d7e80c6b9f193f247a04de3a366ba38bad1507))
* **network:** switch port collision guard and bundled multi-cable routing with ribbon offsets ([eac2655](https://github.com/Dumerat/NetFloor/commit/eac26553e1f92ecf0e1c28eb964751ad93f6f51c))
* **palette:** multi-persona equipment catalog, realistic 2D rendering & parametric sizing ([b84590c](https://github.com/Dumerat/NetFloor/commit/b84590c02112e3d30a0d6cd721051d745575242c))
* **plans:** multi-plan management with indexedDB persistence ([f312995](https://github.com/Dumerat/NetFloor/commit/f3129951c13524c2d69c62b337c77b50ea1f39c9))
* purge all hardcoded residual data — clean empty default state ([fbaa967](https://github.com/Dumerat/NetFloor/commit/fbaa967545a5caf2bc7d909d172a5aedca5655ea))
* **rack:** custom rack dimensions, dynamic U stack, editable patching and switch port visualizer ([a33aff4](https://github.com/Dumerat/NetFloor/commit/a33aff43687384e6853402b872c369657ae700b8))
* **rack:** decouple multi-rack devices and implement resizable sidebars with min-max constraints ([b3a957d](https://github.com/Dumerat/NetFloor/commit/b3a957db9b879ea655da728fbd558ebd13fe783e))
* **rack:** proportional rack depth, U collision prevention, and network topology panel ([827b5ce](https://github.com/Dumerat/NetFloor/commit/827b5ce87f678432fe29ac6239da90b7dfd19bb3))
* remove pre-existing VLANs from default state ([768dc53](https://github.com/Dumerat/NetFloor/commit/768dc532f86deb4a4e35c12590aec6ec67844e20))
* replace all fake integration responses with real HTTP calls ([55c376c](https://github.com/Dumerat/NetFloor/commit/55c376c331fb03cc9906f04233a195903dff93e6))
* right-click delete, drag-and-drop from palette, auto-link to desks, remove compact/exec desks and neighbor docking ([ef4fc0c](https://github.com/Dumerat/NetFloor/commit/ef4fc0cd331ea7db4241f558d4172f2a1b998f9a))
* **settings:** add enterprise settings center with SSO, active SNMP discovery, IPAM and ITSM integrations ([ecd3ba1](https://github.com/Dumerat/NetFloor/commit/ecd3ba1af34084d241976a969166fa6ccb46c20b))
* **settings:** move settings to bottom-left sidebar, add Active Directory LDAP/LDAPS, real persistence and SNMP-to-floor sync ([03c483f](https://github.com/Dumerat/NetFloor/commit/03c483f65be81288b4ec7c4600a937a94f30ab32))
* simplify colonnette and outlet port visuals, hover labels with master toggle, and 4-way label positioning ([be55bc0](https://github.com/Dumerat/NetFloor/commit/be55bc0c450125e508c58682f8918b30ef98fa15))
* **sites:** multi-site infrastructure separation and dedicated panel ([2afaf35](https://github.com/Dumerat/NetFloor/commit/2afaf35e5476e8bc6137354291c649484a83da20))
* **spatial:** 2D transformation matrix, metric snapping & Zustand camera store ([3559c45](https://github.com/Dumerat/NetFloor/commit/3559c4585f9e1bd761d51a0157201aa09985a403))
* **spatial:** macro campus deep zoom support and spatial tests ([9757f7a](https://github.com/Dumerat/NetFloor/commit/9757f7adf37617c94d4475d667e2211bbaa112ed))
* **spawner:** batch desk island spawner and orthogonal auto-routing ([895adea](https://github.com/Dumerat/NetFloor/commit/895adea69d15de61605571777f13c2c37c4d5708))
* **tools:** metric ruler and scale calibration tools ([db769b7](https://github.com/Dumerat/NetFloor/commit/db769b751ed4212428bc7b1e6ad7a4c3169a5568))
* **ui:** add cloud switch discovery, modern scrollbars and customizer styling ([057c011](https://github.com/Dumerat/NetFloor/commit/057c011d1a308a7e3ff6643e7a862d4ca529426a))
* **ui:** single vlan style tab selector and fixed administration center dimensions ([56975d6](https://github.com/Dumerat/NetFloor/commit/56975d6da5a60bfdfbee3f7ba53bb26adf789e19))
* **ui:** unified ipam vlan selector, single add menu, generic port and custom port profiles ([0b7109e](https://github.com/Dumerat/NetFloor/commit/0b7109eaecb5829082a206525461374a893b9f76))
* **visual:** multi-port RJ45 stacked slots, desk snapping, cable filters and interactive waypoint curves ([a136d9a](https://github.com/Dumerat/NetFloor/commit/a136d9ac4896137f1d5be9a45703ef90ec857936))
* **vlan-styles:** remove obsolete backbone filter and add full cable customization (colors, dashed/dotted, thickness) ([41712d0](https://github.com/Dumerat/NetFloor/commit/41712d0734a86e9c26453c7d488e56d0c794a2c0))
* **voip:** add desk IP phone visual, IP display in user/desk cards, and fix colon wrapping ([b8ff680](https://github.com/Dumerat/NetFloor/commit/b8ff68017e9133f6acbb42e57d35a5ffb0c5e9b7))
* **zones:** custom floor dimensions and visual department zone delimitation ([a01be40](https://github.com/Dumerat/NetFloor/commit/a01be40c4b232dc4114dcac786006a1e7e3f84f7))


### 🐛 Corrections de bugs

* **cables:** single natural 90deg bend by default, direct corner dragging without phantom waypoints ([0cf46ad](https://github.com/Dumerat/NetFloor/commit/0cf46ade5ce98f737786e4ef15ea9c88a45e2a99))
* **canvas:** keep labels horizontal on rotation & synchronize attached outlets with desk center ([9163626](https://github.com/Dumerat/NetFloor/commit/9163626501e1fc3a422baebc732c8dd22c9f170b))
* **canvas:** marquee multi-selection, bulk group drag and app integration ([0976a09](https://github.com/Dumerat/NetFloor/commit/0976a0999ed3e4ca86c909cb02921ab4e97f818e))
* **canvas:** sanitize cable and pivot coordinates against NaN warnings ([7288b35](https://github.com/Dumerat/NetFloor/commit/7288b3543e3658e84c8377cf0b1289dc20b7b43c))
* **ci:** bump sonarqube-scan-action to v6 and configure SonarCloud organization ([eb9d423](https://github.com/Dumerat/NetFloor/commit/eb9d423c848501c179eed93ccf0a062082e69dda))
* **ci:** exclude Next.js UI sources from Sonar analysis scope ([db8a0a1](https://github.com/Dumerat/NetFloor/commit/db8a0a1359d1d284bf2aef1905f756d066e49cca))
* **deps:** bump drizzle-orm to 0.45.2 to resolve high severity security advisory ([6f64f06](https://github.com/Dumerat/NetFloor/commit/6f64f062a4f925538ac909f9e541eee92abd8acd))
* dual-engine db failover, clean reset of background plans/sites, rack slotU normalization and cleanup ([d1bcdfc](https://github.com/Dumerat/NetFloor/commit/d1bcdfccb490158271c8d4830b1f801c1d85b02b))
* make new racks and equipment completely clean and empty by default ([e172559](https://github.com/Dumerat/NetFloor/commit/e172559e48bc85e768f184a1bf9ca19be0ff395f))
* **quality:** resolve sonar reliability bugs and exclude UI from coverage calculation ([9ed1e86](https://github.com/Dumerat/NetFloor/commit/9ed1e8647ec5d7c87affb78065ea9ad5706eeedd))
* **run.sh:** resolve cached pnpm and disable corepack download prompt ([c73e8e4](https://github.com/Dumerat/NetFloor/commit/c73e8e4e5326cd42d281c2ee3435fbff13d89c8c))
* **zones:** prevent zone drag unless selected and enrich test setup with racks and links ([5a42e1c](https://github.com/Dumerat/NetFloor/commit/5a42e1c1a1ab52f8700cfa07a0b8fa662a5f139f))


### ⚡ Performances

* **canvas:** optimize render pipeline, separate view vs edit modes, enlarge distant labels and keep desk labels permanent ([42b7ab1](https://github.com/Dumerat/NetFloor/commit/42b7ab109940407cfcacc39ad5fb90c01d3d7b80))
* **canvas:** remove CPU shadowBlur, disable hit-testing on static shapes & throttle drag moves with RAF ([a6d3631](https://github.com/Dumerat/NetFloor/commit/a6d36319812b01324a4a7fa18640711d52925f10))
* **canvas:** remove heavy zone cartouche blur for 60fps & enlarge left sidebar ([f4cc70a](https://github.com/Dumerat/NetFloor/commit/f4cc70afdb9695b40f318d8dbdbe7e378c6e66d9))


### ♻️ Refactoring

* **cables:** implement strict 90deg orthogonal routing with mono-axis dragBoundFunc handles and node-independent waypoints ([04cb85b](https://github.com/Dumerat/NetFloor/commit/04cb85b801521db6f4f0abef37f9aa80842f6574))
* **cables:** implement Unique Orthogonal Pivot routing with free 2D draggable handle and clean single-pivot state ([254f52d](https://github.com/Dumerat/NetFloor/commit/254f52dce7f509375d0e988e4fe887e9d8f969c0))


### 📖 Documentation

* add ANTIGRAVITY_HANDOVER.md complete briefing for machine migration ([63ed5c9](https://github.com/Dumerat/NetFloor/commit/63ed5c9ecc03732636f0a4067198bf986e40a420))


### 💄 Style / Formatage

* format codebase with prettier and clean ESLint rules for CI ([669dc52](https://github.com/Dumerat/NetFloor/commit/669dc5256af4c0be73168c7f801e9444d44f5073))
* prettier format 5 files (format:check CI fix) ([ae3de3d](https://github.com/Dumerat/NetFloor/commit/ae3de3d2017ae67da6becf186f1763536c6f7338))


### 🔧 Build / Config

* enhance release-please, commitlint and husky setup ([00e24bf](https://github.com/Dumerat/NetFloor/commit/00e24bf8046e49a1f4c20b4cc2389ae49cf2d405))


### 👷 CI/CD

* add GitHub Actions workflow, Vitest LCOV coverage and SonarQube configuration ([68d709e](https://github.com/Dumerat/NetFloor/commit/68d709ef18d7c09dc2564a9e229ae1906186474e))
* fix pnpm version resolution in CI, add Makefile and run.sh launcher ([68fb82a](https://github.com/Dumerat/NetFloor/commit/68fb82a7641f827448f96284c6ff04483112c41e))
