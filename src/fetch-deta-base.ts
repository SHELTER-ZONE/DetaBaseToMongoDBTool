import { mkdir, writeFile } from 'fs/promises'
import 'dotenv/config'
import { Deta } from 'deta'

const fetchDataBase = async(deta: ReturnType<typeof Deta>, name: string) => {
  const timeStart = Date.now()

  // Fetch data
  const base = deta.Base(name)
  let res = await base.fetch()
  let data = res.items
  while (res.last) {
    res = await base.fetch({}, { last: res.last })
    data = data.concat(res.items)
  }

  // Write data to file
  await writeFile(`data/${name}.json`, JSON.stringify(data))

  console.log(`Export ${data.length} items from base(${name}) in ${Date.now() - timeStart}ms`)
}

const getDataBase = async() => {
  // Check if Deta project key is set
  if (!process.env.DETA_PROJECT_KEY) {
    console.log('No Deta project key found')
    return
  }

  // Create data folder
  await mkdir('data', { recursive: true })

  // Connect to Deta bases
  const deta = Deta(process.env.DETA_PROJECT_KEY)

  // Export data from Deta bases
  const timeStart = Date.now()
  const baseName = [ 'user', 'userProfile', 'dailyCheck', 'log', 'forms', 'botConfig', 'cacheData' ]
  await Promise.allSettled(baseName.map((name) => fetchDataBase(deta, name)))
  console.log(`All data export complete in ${Date.now() - timeStart}ms`)
}

getDataBase()