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
  const queuePut: Omit<SZUser, 'createAt' | 'id' | 'updateAt'>[] = []

  const detaSZUsers: DetaSZUser[] = JSON.parse(await readFile('data/user.json', 'utf8'))
  const mongodbSZUsers = await User.find()

  for (const user of detaSZUsers) {
    if (mongodbSZUsers.find((mdbUser) => mdbUser.userId === user.id)) {
      await User.updateOne({ userId: user.id }, { type: user.type })
    }
    else {
      queuePut.push({ userId: user.id, type: user.type })
    }
  }
  await User.insertMany(queuePut)

  console.log(`[${mongoose.connection.name}.user] Put ${queuePut.length}, Update ${detaSZUsers.length - queuePut.length} items in ${Date.now() - timeStart}ms`)
}

const saveSZUserProfile = async() => {
  const timeStart = Date.now()
  const queuePut: (Omit<SZUserProfile, 'createAt' | 'id' | 'updateAt' | 'user'> & { user: QueryType<ReturnType<typeof User.findOne>> | null })[] = []

  const detaSZUserProfile: DetaSZUserProfile[] = JSON.parse(await readFile('data/userProfile.json', 'utf8'))
  const mongodbSZUserProfile = await UserProfile.find()

  for (const userProfile of detaSZUserProfile) {
    const mdbSZUser = await User.findOne({ userId: userProfile.userId })
    if (mongodbSZUserProfile.find((mdbUserProfile) => mdbUserProfile.user.toString() === mdbSZUser?.id)) {
      await UserProfile.updateOne({ user: mdbSZUser?.id }, { name: userProfile.name, rep: userProfile.rep })
    }
    else {
      queuePut.push({ user: mdbSZUser, name: userProfile.name, rep: userProfile.rep })
    }
  }
  await UserProfile.insertMany(queuePut)

  console.log(`[${mongoose.connection.name}.userProfile] Put ${queuePut.length}, Update ${detaSZUserProfile.length - queuePut.length} items in ${Date.now() - timeStart}ms`)
}

const updateSZUser = async() => {
  const timeStart = Date.now()
  const queueUpdate = []
  let count = 0

  const mongodbSZUsers = await User.find()

  for (const mdbSZUser of mongodbSZUsers) {
    const mdbSZUserProfile = await UserProfile.findOne({ user: mdbSZUser.id })
    if (mdbSZUserProfile) {
      mdbSZUser.profiles = { userProfile: mdbSZUserProfile.id }
      queueUpdate.push(mdbSZUser.save())
      ++count
    }
  }
  await Promise.all(queueUpdate)

  console.log(`[${mongoose.connection.name}.user] Update ${count} items in ${Date.now() - timeStart}ms`)
}

const saveSZDailyCheck = async() => {
  const timeStart = Date.now()
  const queuePut: (Omit<SZDailyCheckRecord, 'id' | 'lastRecord'> & { lastRecord: string })[] = []

  const detaSZDailyCheck: DetaSZDailyCheck[] = JSON.parse(await readFile('data/dailyCheck.json', 'utf8'))
  const mongodbSZDailyCheck = await DailyCheck.find()

  for (const dailyCheck of detaSZDailyCheck) {
    if (mongodbSZDailyCheck.find((mdbDailyCheck) => mdbDailyCheck.userId === dailyCheck.memberID)) {
      await DailyCheck.updateOne({ userId: dailyCheck.memberID }, { lastRecord: dailyCheck.lastCheck })
    }
    else {
      queuePut.push({
        userId: dailyCheck.memberID,
        lastRecord: dailyCheck.lastCheck
      })
    }
  }
  await DailyCheck.insertMany(queuePut)

  console.log(`[${mongoose.connection.name}.dailyCheck] Put ${queuePut.length}, Update ${detaSZDailyCheck.length - queuePut.length} items in ${Date.now() - timeStart}ms`)
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
  await saveSZUser()
  await saveSZUserProfile()
  await updateSZUser()
  await saveSZDailyCheck()
  console.log(`All data save complete in ${Date.now() - timeStart}ms`)
}

putMongoDB().then(() => mongoose.disconnect())