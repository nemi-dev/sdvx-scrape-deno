import { DOMParser, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { sleep } from "https://deno.land/x/sleep@v1.3.0/mod.ts"

async function exist(local) {
  try {
    await Deno.stat(local);
    return true
  } catch (error) {
    return false
  }
}

async function save(src) {
  const url = new URL(src)
  const imgKey = url.searchParams.get('img')
  const dst = `img/${imgKey}.jpg`
  if (await exist(dst)) {
    console.log(`${src} already exists.`)
    return
  }
  console.log(`Writing image ${src}...`)
  const response = await fetch(src)
  const imageBuffer = await response.arrayBuffer()

  await Deno.writeFile(dst, new Uint8Array(imageBuffer));
}

/**
 * @param {string} href 
 * @param {string} url 
 */
function link(href) {
  if (href.startsWith("https://") || href.startsWith("http://")) return href
  const url = "https://usta.kr/sdvx/music/index.php"
  return new URL(href, url).href
}

async function doc(url) {
  const response = await fetch(url)
  
  if (!response.ok) {
    console.error("Failed to fetch the webpage:", response.status)
    return null
  }
  
  const html = await response.text()
  const parser = new DOMParser()
  const document = parser.parseFromString(html, "text/html")
  return document
}

function indexPage() {
  return doc("https://usta.kr/sdvx/music/index.php")
}

/** 
 * @param {number} pg
*/
async function pageAt(pg) {
  const url = "https://usta.kr/sdvx/music/index.php"
  const formData = new FormData()
  formData.append("page", pg)

  const response = await fetch(url, {
    method: "POST",
    body: formData
  })
  
  if (!response.ok) {
    console.error("Failed to fetch the webpage:", response.status)
    return null
  }
  
  const html = await response.text()
  const parser = new DOMParser()
  const document = parser.parseFromString(html, "text/html")
  return document
}


/**
 * @param {HTMLDocument} document 
 */
function scrape(document) {
  if (document == null) return
  const musics = Array.from(document.querySelectorAll("#music-result .music"))
  for (const music of musics) {

    /** @type {string[]} */
    const s = []

    /** @type {string[]} */
    const genres = Array.from(music.querySelectorAll(".genre"))
    .reduce((li, el) => {
      const cl = Array.from(el.classList)
      for (const clname of cl) {
        if (clname === "genre") continue
        if (!li.includes(clname)) li.push(clname)
        return li
      }
    }, s)

    const detailAnchor = music.querySelector(".jk a")
    const detailHref = link(detailAnchor.getAttribute("href"))

    const indexImage = music.querySelector(".jk img")
    const indexja = link(indexImage.getAttribute("src"))
    
    const info = music.querySelector(".inner .info")

    const title = info.children[0].innerText
    const artist = info.children[1].innerText
    const [nov, adv, exh, mxm] = Array.from(info.children[2].children).map(el => parseInt(el.innerText))
    const unlockRaw = info.children[3].innerText

    console.log({ 
      title,
      artist,
      nov,
      adv,
      exh,
      mxm,
      genre: genres.join(' '),
      unlockRaw,
      indexja,
      detailHref,
     })

     save(indexja)
  }
}

const index = await indexPage();
if (index == null) Deno.exit(1)

const select = index.querySelector("#search_page")
const values = Array.from(select.children).map(el => el.getAttribute("value"))
const pages = values.length

scrape(index)
await sleep(5)

for (let i = 2; i <= pages; i += 1) {
  const page = await pageAt(i)
  scrape(page)
  await sleep(5)
  break
}
