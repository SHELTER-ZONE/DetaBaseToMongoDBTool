import { readFile } from 'fs/promises'
import 'dotenv/config'
import mongoose from 'mongoose'
import { User, UserProfile, DailyCheck } from '@shelter-zone/sz-data-models'
import type { SZUser as DetaSZUser } from '@shelter-zone/sz-api-types/SZUser'
import type { SZUserProfile as DetaSZUserProfile } from '@shelter-zone/sz-api-types/SZUserProfile'
import type { SZDailyCheck as DetaSZDailyCheck } from '@shelter-zone/sz-api-types/SZDailyCheck'
import type { SZUser } from '@shelter-zone/sz-api-types/v2/SZUser'
import type { SZUserProfile } from '@shelter-zone/sz-api-types/v2/SZUserProfile'
import type { SZDailyCheckRecord } from '@shelter-zone/sz-api-types/v2/SZDailyCheck'

const saveSZUser = async() => {
  const timeStart = Date.now()
  const dataPut: Omit<SZUser, 'createAt' | 'id' | 'updateAt'>[] = []
  const queueUpdate = []

  const [ detaSZUsers, mongodbSZUsers ] = await Promise.all([ readFile('data/user.json', 'utf8'), User.find() ])

  for (const user of JSON.parse(detaSZUsers) as DetaSZUser[]) {
    if (mongodbSZUsers.find((mdbUser) => mdbUser.userId === user.id)) {
      queueUpdate.push(User.updateOne({ userId: user.id }, { type: user.type }))
    }
    else {
      dataPut.push({ userId: user.id, type: user.type })
    }
  }
  await Promise.allSettled([ User.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.user] Put ${dataPut.length}, Update ${detaSZUsers.length - dataPut.length} items in ${Date.now() - timeStart}ms`)
}

const saveSZDailyCheck = async() => {
  const timeStart = Date.now()
  const dataPut: (Omit<SZDailyCheckRecord, 'id' | 'lastRecord'> & { lastRecord: string })[] = []
  const queueUpdate = []

  const [ detaSZDailyCheck, mongodbSZDailyCheck ] = await Promise.all([ readFile('data/dailyCheck.json', 'utf8'), DailyCheck.find() ])

  for (const dailyCheck of JSON.parse(detaSZDailyCheck) as DetaSZDailyCheck[]) {
    if (mongodbSZDailyCheck.find((mdbDailyCheck) => mdbDailyCheck.userId === dailyCheck.memberID)) {
      queueUpdate.push(DailyCheck.updateOne({ userId: dailyCheck.memberID }, { lastRecord: dailyCheck.lastCheck }))
    }
    else {
      dataPut.push({ userId: dailyCheck.memberID, lastRecord: dailyCheck.lastCheck })
    }
  }
  await Promise.allSettled([ DailyCheck.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.dailyCheck] Put ${dataPut.length}, Update ${detaSZDailyCheck.length - dataPut.length} items in ${Date.now() - timeStart}ms`)
}

const saveSZUserProfile = async() => {
  const timeStart = Date.now()
  const dataPut: (Omit<SZUserProfile, 'createAt' | 'id' | 'updateAt' | 'user'> & { user: QueryType<ReturnType<typeof User.findOne>> | null })[] = []
  const queueUpdate = []

  const [ detaSZUserProfiles, mongodbSZUsers, mongodbSZUserProfiles ] = await Promise.all([ readFile('data/userProfile.json', 'utf8'), User.find(), UserProfile.find() ])

  for (const userProfile of JSON.parse(detaSZUserProfiles) as DetaSZUserProfile[]) {
    const mdbSZUser = mongodbSZUsers.find((mdbUser) => mdbUser.userId === userProfile.userId)
    if (mongodbSZUserProfiles.find((mdbUserProfile) => mdbUserProfile.user.toString() === mdbSZUser?.id)) {
      queueUpdate.push(UserProfile.updateOne({ user: mdbSZUser?.id }, { name: userProfile.name, rep: userProfile.rep }))
    }
    else {
      dataPut.push({ user: null, name: userProfile.name, rep: userProfile.rep })
    }
  }
  await Promise.allSettled([ UserProfile.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.userProfile] Put ${dataPut.length}, Update ${detaSZUserProfiles.length - dataPut.length} items in ${Date.now() - timeStart}ms`)
}

const updateSZUser = async() => {
  const timeStart = Date.now()
  const queueUpdate = []

  const [ mongodbSZUsers, mongodbSZUserProfiles ] = await Promise.all([ User.find(), UserProfile.find() ])

  for (const userProfile of mongodbSZUserProfiles) {
    const mdbSZUser = mongodbSZUsers.find((mdbUser) => mdbUser.id === userProfile.user.toString())
    if (!mdbSZUser) continue

    mdbSZUser.profiles = { userProfile: userProfile.id }
    queueUpdate.push(mdbSZUser.save())
  }

  await Promise.allSettled(queueUpdate)

  console.log(`[${mongoose.connection.name}.user] Update ${queueUpdate.length} items reference in ${Date.now() - timeStart}ms`)
}

const putMongoDB = async() => {
  // Check if mongoDB URI is set
  if (!process.env.MONGODB_URI) {
    console.log('No mongoDB URI found')
    return
  }

  // Connect to mongoDB
  await mongoose.connect(process.env.MONGODB_URI)

  const timeStart = Date.now()
  await Promise.allSettled([
    saveSZUser(),
    saveSZDailyCheck()
  ])
  await saveSZUserProfile()
  await updateSZUser()
  console.log(`All data save complete in ${Date.now() - timeStart}ms`)
}

putMongoDB().then(() => mongoose.disconnect())