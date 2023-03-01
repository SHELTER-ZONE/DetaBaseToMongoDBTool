import { mkdir, writeFile } from 'fs/promises'
import 'dotenv/config'
import { Deta } from 'deta'

const fetchDataBase = async(baseName: string[]) => {
  // Check if Deta project key is set
  if (!process.env.DETA_PROJECT_KEY) {
    console.log('No Deta project key found')
    return
  }

  // Connect to Deta bases
  const deta = Deta(process.env.DETA_PROJECT_KEY)

  // Create data folder
  await mkdir('data', { recursive: true })

  // Export data from Deta bases
  const timeStart = Date.now()
  for (const name of baseName) {
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

    console.log(`Export ${data.length} items from ${name} base in ${Date.now() - timeStart}ms`)
  }
  console.log(`All data export complete in ${Date.now() - timeStart}ms`)
}

fetchDataBase([ 'user', 'userProfile', 'dailyCheck', 'log', 'forms', 'botConfig', 'cacheData' ])