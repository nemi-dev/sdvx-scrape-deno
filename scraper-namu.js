/* 
https://namu.wiki/w/%EC%82%AC%EC%9A%B4%EB%93%9C%20%EB%B3%BC%ED%85%8D%EC%8A%A4%20%EC%9D%B5%EC%8B%9C%EB%93%9C%20%EA%B8%B0%EC%96%B4/%EC%88%98%EB%A1%9D%EA%B3%A1

Run this script at the browser console.
*/
((() => {

const predicateHeader = ['곡명','명의','NOV','ADV','EXH','MXM','BPM','비고']
const udiff = ["unov", "uadv", "uexh", "umxm"]
const song_cols = ["title", "artist", "bpm", "slow", "nov", "adv", "exh", "mxm", ...udiff, "from", "at", "etc"]
const unlockType = {    
  "rgb(221, 221, 221)": 'pcb',
  "rgb(170, 170, 255)": 'sp',
  "rgb(255, 255, 170)": 'lim',
  "rgb(170, 255, 255)": 'Ω',
  "rgb(160, 255, 255)": 'Ω',
  "rgb(255, 170, 255)": 'hexa',
  "rgb(188, 229, 92)": 'tama',
  "rgb(255, 170, 170)": 'kona'
}

/** @type {{[key: string]: { content: string, from: string[] }}} */
const captions = {}

/** @param {HTMLAnchorElement} a */
function getContentOf(a) {
  const hash = a.getAttribute("href")
  const captionId = decodeURIComponent(hash.replace(/^\#/, ''));
  const captionKey = decodeURIComponent(hash.replace(/^\#fn-/, ''));
  return document.getElementById(captionId)?.parentElement.innerText.replace(`[${captionKey}] `, "").replace(/^(\d+\.\d+\s+)+/g, '') ?? ''
}

function addCaptionNoRef(key, content) {
  captions[key] ??= { content, from: [] }
}

/** @param {HTMLAnchorElement} a */
function addCaption(a, from) {
  const hash = a.getAttribute("href")
  const captionKey = decodeURIComponent(hash.replace(/^\#fn-/, ''));
  const caption = (captions[captionKey] ??= { content : getContentOf(a), from: [] })
  caption.from.push(from)
}

/**
 * @param {HTMLElement} el 
 * @param {number} row 
 * @param {number} col 
 */
function extractText(el, row, col, preserve = false) {
  /** @type {HTMLElement} */
  el = el.cloneNode(true);

  const caps = Array.from(el.querySelectorAll("a[href^='#']"))
  if (!preserve) caps.forEach(el => el.remove())

  const text = el.innerText.replace(/\n/g, " ");
  caps.forEach(e => addCaption(e, `${text} @[${row}][${col}]`))
  return text;
}

/** @param {HTMLElement} el */
function extractTextWithExpandCaption(el) {
  /** @type {HTMLElement} */
  el = el.cloneNode(true);
  
  Array.from(el.querySelectorAll("a[href^='#']")).forEach(a => {
    a.parentNode.insertBefore(document.createTextNode(getContentOf(a)), a)
    a.remove()
  })
  return el.innerText
}

/** @param {HTMLElement} el */
function getTitle(el) {
  el = el.cloneNode(true);
  Array.from(el.querySelectorAll("a[href^='#']")).forEach(el => el.remove())
  return el.innerText.replace(/\n/g, " ");
}

/**
 * @param {HTMLElement} tableElement 
 * @returns {HTMLHeadingElement}
 */
function getHeading(tableElement) {
  let currentElement = tableElement;

  while (currentElement) {
      let sibling = currentElement.previousElementSibling;
      while (sibling) {
          if (sibling.tagName === 'H3') {
              return sibling;
          }
          const descendantHeading = sibling.querySelector("h3");
          if (descendantHeading) {
              return descendantHeading;
          }
          sibling = sibling.previousElementSibling;
      }
      
      currentElement = currentElement.parentElement;
  }
  return null;
}


  /**
   * 
   * @param {HTMLTableElement} table 
   */
  function handleTable(table) {
    if (!table.tBodies) return [];
    const songs = [];
    const tbody = table.tBodies[0];
    let rowIndex = 0;
    let from = null;
    Array.from(table.querySelectorAll("td[rowspan]")).forEach((td) => {
      const rowSpan = td.rowSpan;
      if (rowSpan > 1) {
        const row = td.parentElement;
        const colIndex = Array.from(row.cells).indexOf(td)
        const rowIndex = Array.from(tbody.rows).indexOf(row)
        const rowIndexTo = rowIndex + rowSpan;
        for (let i = rowIndex + 1; i < rowIndexTo; i += 1) {
          tbody.rows[i].insertCell(colIndex)
          tbody.rows[i].cells[colIndex].innerHTML = td.innerHTML
        }
      }
      td.removeAttribute("rowspan")
    })
    for (const row of tbody.rows) {
      if (rowIndex == 0) {
        if (!Array.from(row.cells)
          .slice(0,7)
        .map(cell => cell.innerText)
        .every((v, i, a) =>  v == predicateHeader[i])) return [];
        rowIndex += 1
        continue
      }
      if (row.cells.length == 1) {
        from = row.cells[0].innerText
        continue
      }
      if (row.cells.length >= 2) {
        const cellsArray = Array.from(row.cells)
        const _rowid = getTitle(cellsArray[0])
        
        let slow = null;
        let [ title, artist, nov, adv, exh, mxm, bpm, extra ] = cellsArray.map((el, index) => {
          if (index === 7) {
            if (Array.from(el.querySelectorAll("a[href^='#']"))
              .every(el => el.getAttribute("href").match(/^\#fn-\d+$/)))
              return extractTextWithExpandCaption(el)
            else return extractText(el, _rowid, predicateHeader[index], true)
          }
          return extractText(el, _rowid, predicateHeader[index])
        })
        if (bpm.split('-').length > 1) {
          [slow, bpm] = bpm.split('-')
        }
        const song = {
          title, artist, bpm, slow, nov, adv, exh, mxm, from, extra
        }
        

        const levels = cellsArray.slice(2, 6)
        levels.forEach((level, levelIndex) => {
          if (level.style.backgroundColor) {
            const use = level.style.backgroundColor in unlockType ? unlockType[level.style.backgroundColor] : level.style.backgroundColor
            song[udiff[levelIndex]] = use
          }
        })
        songs.push(song)
        rowIndex += 1
      }
    }

    const heading = getHeading(table);
    let at = heading?.querySelector("span")?.innerText.split('\n')[0]
    let match = at.match(/^\s*(VI\s*\d+)\:(.*)\s*$/)
    if (match) {
      at = match[1]
      addCaptionNoRef(match[1], match[2])
    }

    songs.forEach(song => song.at = at)

    return songs
  }

  const allSongs = Array.from(document.querySelectorAll("table")).flatMap(handleTable)

  const matrix = allSongs.map(({title, artist, bpm, slow = '', nov, adv, exh, mxm, extra, unov = '', uadv = '', uexh = '', umxm = '', from = '', at = ''}) =>
    [title, artist, bpm, slow, nov, adv, exh, mxm, unov, uadv, uexh, umxm, from, at, extra])

  const songsTable = {
    cols: song_cols,
    data: matrix
  }
  {
    const text = matrix.map(a => a.join("\t")).join("\n")
    const blob = new Blob([
      song_cols.join("\t") + "\n",
      text
    ], { type: "text/plain" })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = "sdvx.tsv"
    a.click()
  }
  {
    const text = Object.entries(captions).sort((a, b) => a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0).map(([k, { content: con, from }]) => {
      return [k, con, from.join(", ")]
    }).map(a => a.join("\t")).join("\n")
    const blob = new Blob([
      ["key", "content", "from"].join("\t") + "\n",
      text
    ], { type: "text/plain" })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = "sdvx-captions.tsv"
    a.click()
  }

  
  const c = {
    songs: songsTable,
    captions
  }

  return c

})())
