#!/usr/bin/env deno run --allow-net --allow-read --allow-write
import { stringify } from "jsr:@std/csv";
import { DOMParser, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts"
import { sleep } from "https://deno.land/x/sleep@v1.3.0/mod.ts"

const musics_ko = "https://usta.kr/sdvx/music/index.php"
const musics =  "https://p.eagate.573.jp/game/sdvx/vi/music/index.html"
const csvColumns = ['title', 'artist', 'nov', 'adv', 'exh', 'mxm', 'genre', 'unlockRaw', 'indexjk', 'jknov', 'jkadv', 'jkexh', 'jkmxm']

const useMusic = musics

async function exist(local) {
  try {
    await Deno.stat(local);
    return true
  } catch (error) {
    return false
  }
}

/**
 * @param {string} src 
 */
async function save(src) {
  if (!src) return
  const imgKey = src?.match(/\?img=(.*)/)?.[1]
  if (imgKey == null) return console.warn(`${src} is not sdvx image link.`)
  
  const dst = `img/${imgKey}.jpg`
  if (await exist(dst)) return console.log(`${src} already exists.`)
  
  const response = await fetch(src)
  console.log(`Writing image ${src}...`)
  const imageBuffer = await response.arrayBuffer()

  Deno.writeFile(dst, new Uint8Array(imageBuffer));
}

/**
 * @param {URL | Request | string} input 
 * @param {RequestInit} init 
 * @returns 
 */
async function doc(input, init = undefined) {
  const response = await fetch(input, init)
  
  if (!response.ok) {
    console.error("Failed to fetch the webpage:", response.status)
    return null
  }
  
  const html = await response.text()
  const parser = new DOMParser()
  const document = parser.parseFromString(html, "text/html")
  return document
}

/** @param {number} pg */
function pageAt(pg) {
  const formData = new FormData()
  formData.append("page", pg)
  return doc(useMusic, {
    method: "POST",
    body: formData
  })
}

async function jackets(url) {
  const document = await doc(url)
  return Array.prototype.map.call(document.querySelectorAll(".jk img"), el => el.getAttribute("src"))
}


/**
 * @param {HTMLDocument} document 
 * @param {string} currentLocation
 */
async function scrape(document, currentLocation) {
  if (document == null) return
  const _resolve = href => new URL(href, currentLocation).href

  const musicElements = document.querySelectorAll("#music-result .music")

  const musics = []
  for (const musicEl of musicElements) {

    /** @type {string[]} */
    const s = []

    /** @type {string[]} */
    const genres = Array.from(musicEl.querySelectorAll(".genre"))
    .reduce((li, el) => Array.from(el.classList).filter(cl => !(cl === "genre" || li.includes(cl))).concat(li), s)

    const indexjk = _resolve(musicEl.querySelector(".jk img").getAttribute("src"))

    const title = musicEl.querySelector(".info p:nth-of-type(1)").innerText
    const artist = musicEl.querySelector(".info p:nth-of-type(2)").innerText // <- ko

    /** @type {number} */
    const [nov, adv, exh, mxm] = Array.prototype.map.call(musicEl.querySelectorAll(".level > p"), el => parseInt(el.innerText))
    const [jknov, jkadv, jkexh, jkmxm] = await jackets(_resolve(musicEl.querySelector(".jk a").getAttribute("href")))
    const unlockRaw = musicEl.querySelector(".info p:nth-child(4)")?.innerText

    save(indexjk)
    save(jknov)
    save(jkadv)
    save(jkexh)
    save(jkmxm)

    const music = { 
      title, artist, nov, adv, exh, mxm,
      genre: genres.join(','),
      unlockRaw,
      indexjk: indexjk?.match(/\?img=(.*)/)?.[1],
      jknov: jknov?.match(/\?img=(.*)/)?.[1],
      jkadv: jkadv?.match(/\?img=(.*)/)?.[1],
      jkexh: jkexh?.match(/\?img=(.*)/)?.[1],
      jkmxm: jkmxm?.match(/\?img=(.*)/)?.[1],
    }

    musics.push(music)
    const row = stringify([music], { columns: csvColumns, headers: false, separator: "\t" })
    await Deno.writeTextFile("music.tsv", row + "\n", { append: true, create: false })
  }
  return musics
}

await Deno.mkdir("img", { recursive: true })
const index = await doc(useMusic);

const select = index.querySelector("#search_page")
const values = Array.from(select.children).map(el => el.getAttribute("value"))
const pagesNumber = values.length

await Deno.writeTextFile("music.tsv", csvColumns.join("\t") + "\n")

for (let i = 1; i <= pagesNumber; i += 1) {
  const page = i === 1 ? index : (await pageAt(i))
  await scrape(page, useMusic)
}
