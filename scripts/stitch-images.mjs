// Stitch 134 reference screenshots into tiled contact sheets grouped by capability family.
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'C:\\Users\\Berry\\Desktop\\Ontology Harness'
import { fileURLToPath } from 'node:url'
const OUT = fileURLToPath(new URL('../asset/contact-sheets/', import.meta.url)) + '\\'
mkdirSync(OUT, { recursive: true })

const MANIFEST = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))

const GROUPS = {
  '01-app-building': [
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753264093_1+-+Add+Widget.1753264093409.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753265591_4+-+Add+New+Object+set.1753265591449.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753276825_2+-+Select+Widget.1753276825038.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753277310_3+-+Set+Object+Set.1753277309680.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753278791_8+-+Create+new+Object+Set+Variable.1753278790910.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1760003401_8.3+-+Replace+Object+Table+Variable.1760003401239.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1756895761_Rename+Object+Table.1756895761590.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1756904022_Rename+Header.1756904021791.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1769015410_Step+4.3+-+Layout+Overview.1769015410168.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753275160_7+-+Object+Table+Props+Config.1753275160232.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753347742_2.1+-+Section+Formatting.1753347742152.png',
  ],
  '02-layout': [
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753348468_6+-+Fill+space.1753348468467.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753348616_6.1+-+Auto+max+height.1753348615758.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753282447_9+-+Change+Filter+Colour.1753282447234.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753347673_1+-+Add+New+Section.1753347673715.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753347959_2.2+-+Add+OST+Widget.1753347959727.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753284008_10+-+Change+Filter+Section+Formatting.1753284008034.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753284314_10.1+-+Change+Filter+Section+Formatting.1753284314426.png',
  ],
  '03-filters': [
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753276678_1+-+Add+Filter+Widget.1753276678144.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753278376_6+-+Allow+Users+to+Add+Filters.1753278375787.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753278970_8.1+-+Filter+using+Variable.1753278970436.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1769083231_7+-+Rename+Filter+Output.1769083231085.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753266737_6+-+Rename+variable.1753266737653.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1753277831_5.5+Change+to+Multi-Select+Component.1753277831511.png',
  ],
  '04-pipelines': [
    'pipeline_overview.png',
    'branches-1.png',
    'vertex_overview-system_graph.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1749655488_Clean+Bureau+Transform.1749655488778.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1749821009_Clean+Office+Goods+Transform.1749821009187.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1749823347_Union+Datasets+-+1.1749823346778.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1749823757_Union+Node.1749823756830.png',
    'instructor_5c94cu0kwes1dvz8hn6iyqiv_public_1759877719_Screenshot+2025-10-07+at+5.53.57 PM.1759877719520.png',
    'instructor_5c94cu0kwes1dvz8hn6iyqiv_public_1759958481_Screenshot+2025-10-08+at+4.19.52 PM.1759958480924.png',
    'instructor_5c94cu0kwes1dvz8hn6iyqiv_public_1760116709_Screenshot+2025-10-10+at+12.17.35 PM.1760116709672.png',
  ],
  '05-ontology': [
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1769010682_Step+1.2+-+Ont+man.1769010682432.png',
    'instructor_1719engage4_public_1769010682_Step+1.2+-+Ont+man.1769010682432.png',
    'instructor_1760003401_8.3+-+Replace+Object+Table+Variable.1760003401239.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1756895979_2-+Overview.1756895979445.png',
  ],
  '06-aip': [
    'adfg.jpg',
    'adhadshdf.jpg',
    'afhdafhbcxvbz.jpg',
    'afdgskfhjhgd.jpg',
    'agfdgfksjgzbvx.jpg',
    'afdjgtsyhgd.jpg',
    'dfgjdfhjds.jpg',
    'aetgfsvxdv.jpg',
    'asdfjgskjhytr.jpg',
    'asdfjkejsth.jpg',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1750079495_Use+LLM+Block+Overvie.1750079495191.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1717695462_000e+-+Configuring+an+AI+Agent.1717695461919.png',
    'instructor_6rv9eqj974u5ivyxlj7ndbkii_public_1717696092_000f+-+Building+an+Interactive+Application.1717696092507.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021860_Screenshot+2024-11-19+131017.1732021859748.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021216_Screenshot+2024-11-19+125949.1732021216456.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021375_Screenshot+2024-11-19+130209.1732021375886.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021447_Screenshot+2024-11-19+130348.1732021447794.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021613_Screenshot+2024-11-19+130621.1732021613197.png',
  ],
  '07-workshop-pages': [
    'dfgjdfhjds.jpg',
    'dfg hfgj.jpg',
    'gfh.jpg',
    'h.jpg',
    'aetgfsvxdv.jpg',
    'afdgskfhjhgd.jpg',
    'afdjgtsyhgd.jpg',
    'agfdgfksjgzbvx.jpg',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732023510_Screenshot+2024-11-19+133731.1732023510615.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732023590_Screenshot+2024-11-19+133915.1732023590146.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732023684_Screenshot+2024-11-19+134057.1732023684722.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732023806_Screenshot+2024-11-19+134202.1732023806649.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732023883_Screenshot+2024-11-19+134413.1732023883513.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732024009_Screenshot+2024-11-19+134516.1732024009391.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732024587_Screenshot+2024-11-19+135544.1732024587164.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732024656_Screenshot+2024-11-19+135702.1732024656284.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732024833_Screenshot+2024-11-19+140004.1732024833577.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732024894_Screenshot+2024-11-19+140109.1732024893835.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732025085_Screenshot+2024-11-19+140415.1732025084961.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732025350_Screenshot+2024-11-19+140838.1732025350090.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732025412_Screenshot+2024-11-19+140936.1732025412703.png',
  ],
  '08-vertex-knowledge': [
    'aetgfsvxdv.jpg',
    'asdfjgskjhytr.jpg',
    'asdfjkejsth.jpg',
    'asdhdjdgbvc.jpg',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018054_Screenshot+2024-11-19+120706.1732018054309.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018218_Screenshot+2024-11-19+120954.1732018218337.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018319_Screenshot+2024-11-19+121115.1732018318951.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018424_Screenshot+2024-11-19+121318.1732018424274.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018479_Screenshot+2024-11-19+121415.1732018478929.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018579_Screenshot+2024-11-19+121556.1732018579155.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018743_Screenshot+2024-11-19+121821.1732018743198.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018815_Screenshot+2024-11-19+121947.1732018815227.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732018949_Screenshot+2024-11-19+122205.1732018949075.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732019030_Screenshot+2024-11-19+122322.1732019030525.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732019090_Screenshot+2024-11-19+122417.1732019090523.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021216_Screenshot+2024-11-19+125949.1732021216456.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021375_Screenshot+2024-11-19+130209.1732021375886.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021447_Screenshot+2024-11-19+130348.1732021447794.png',
    'instructor_ab41yi650emw2phw736p0j9rk_public_1732021613_Screenshot+2024-11-19+130621.1732021613197.png',
  ],
  '09-reference-misc': [
    'qa.jpg','qa2.jpg','qwtqeruyart.jpg','retyuyiijuhtsgr.jpg','sagsadg.jpg','sdfjsdh.jpg','sdfrlkghdjfshg.jpg','sdhj.jpg','sfdgkhlfhj;k.jpg','sfdhjgfhfdg.jpg','sfdhsdj.jpg','sfgjsdsf.jpg','SharedScreenshot.jpg','SharedScreenshot2.jpg','SharedScreenshot4.jpg','SharedScreenshot75.jpg','SharedScreenshot752.jpg','SJSFDJ.jpg','we.jpg','wqayryeqfc.jpg','wqeytqeray.jpg','xcvbn,kydjuthsyrgdrf.jpg','xcvnxcmgfshjasd.jpg','zxcbzcxvn .jpg','zxcncxvbm.jpg','adfg.jpg','ADFH.jpg','adhadshdf.jpg','aetgfsvxdv.jpg','dfgjdfhjds.jpg','dgfgj.jpg','dgfhjjsj.jpg','dghkgfk.jpg','dgkdgfkh.jpg','dkdlh.jpg','ewthryukyjthrg.jpg','ewtqytrewgfd.jpg','ewyruwtriyeotykjsghfd.jpg','fgdkdf.jpg','fghk.jpg','fghkgfh.jpg','fhkd.jpg','fqewgqeragvqe.jpg','fsdgfdkfjsghdgd.jpg','h.jpg','fghkgfh.jpg','agaH.jpg','agfdgfksjgzbvx.jpg','azetsgg.jpg','zzetsrt.jpg','agbdgehy.jpg','agsrfdv.jpg','agrptnrh.jpg','agopgey.jpg','asdaasdasd.jpg','asdasdasdasd.jpg','asfertg.jpg','sdfasdfgfh.jpg','sfdgkhlfhj;k.jpg','asjdbf.jpg','asiodf.jpg','asjdbg.jpg','asjdbtr.jpg','asdidg.jpg','adewgre.jpg','asdgasd.jpg','asdgaswed.jpg','asfasd.jpg','asdgasde.jpg','asdgasdf.jpg','h.jpg','agaH.jpg','agfdgfksjgzbvx.jpg','x.jpg','aetgfsvxdv.jpg','xcvbn,kydjuthsyrgdrf.jpg','xcvnxcmgfshjasd.jpg','zxcbzcxvn .jpg','zxcncxvbm.jpg','we.jpg','wqayryeqfc.jpg','wqeytqeray.jpg','qwtqeruyart.jpg','retyuyiijuhtsgr.jpg','sagsadg.jpg','sdfjsdh.jpg','sdfrlkghdjfshg.jpg','sdhj.jpg','sfdgkhlfhj;k.jpg','sfdhjgfhfdg.jpg','sfdhsdj.jpg','sfgjsdsf.jpg','SJSFDJ.jpg','ADFH.jpg','adfg.jpg','adhadshdf.jpg','afdgskfhjhgd.jpg','afdjgtsyhgd.jpg','afhdafhbcxvbz.jpg','agaH.jpg',
  ],
}

// dedupe manually provided groups against each other already done by user; skip invalid files
const valid = new Set(MANIFEST.entries.map(e => e.file))

async function sheet(dir, files) {
  const imgs = []
  for (const f of files) {
    if (!valid.has(f)) continue
    try { const img = sharp(`${SRC}\\${f}`); const meta = await img.metadata(); imgs.push({ path: f, width: meta.width, height: meta.height }) } catch { /* skip unreadable */ }
  }
  if (!imgs.length) return
  const tileW = 480, tileH = 280, cols = 4, rows = Math.ceil(imgs.length / cols)
  const canvasW = cols * tileW, canvasH = rows * tileH
  const composites = []
  for (let i = 0; i < imgs.length; i++) {
    const col = i % cols, row = Math.floor(i / cols)
    const x = col * tileW, y = row * tileH
    const buf = await sharp(`${SRC}\\${imgs[i].path}`).resize(tileW, tileH, { fit: 'contain', background: { r: 250, g: 248, b: 240 } }).png().toBuffer()
    composites.push({ input: buf, left: x, top: y })
    // tile border
    composites.push({ input: Buffer.from(`<svg width="1" height="1"><rect width="1" height="1" fill="#bbf7d0"/></svg>`), left: x, top: y })
  }
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 250, g: 248, b: 240, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(OUT + dir + '-contact-sheet.png')
  console.log('wrote', dir, '-contact-sheet.png', '(' + imgs.length + ' tiles)')
}

for (const [dir, files] of Object.entries(GROUPS)) await sheet(dir, files)
console.log('done')
