import { spawn } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Сборка Android APK одной командой: web build + cap sync + gradle.
 *
 * @param {'release' | 'debug'} flavor - тип сборки (по умолчанию release, оптимизированный).
 * @returns {Promise<void>}
 * @example
 * node scripts/mobile-android.mjs release
 */
async function main() {
    const flavorArg = process.argv[2]
    const flavor = flavorArg === 'debug' ? 'debug' : 'release'
    const gradleTask = flavor === 'debug' ? 'assembleDebug' : 'assembleRelease'
    const isWindows = process.platform === 'win32'
    const gradleBin = isWindows ? '.\\gradlew.bat' : './gradlew'

    const jdkHome = await resolveJdkHome()
    const env = { ...process.env }
    if (jdkHome) {
        env.JAVA_HOME = jdkHome
        env.PATH = `${join(jdkHome, 'bin')}${isWindows ? ';' : ':'}${env.PATH}`
    }

    await run('npm', ['run', 'build'], { cwd: process.cwd(), env })
    await run('npx', ['cap', 'sync'], { cwd: process.cwd(), env })
    await run(gradleBin, [gradleTask], { cwd: join(process.cwd(), 'android'), env, shell: isWindows })

    const apkDir = join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', flavor)
    const apkPath = findApk(apkDir)
    if (apkPath) {
        console.log(`[mobile] APK готов: ${apkPath}`)
    } else {
        console.log(`[mobile] Сборка ${flavor} завершена, APK ищи в ${apkDir}`)
    }
}

/**
 * Запуск команды с потоковым выводом.
 *
 * @param {string} cmd - команда.
 * @param {string[]} args - аргументы.
 * @param {object} options - опции запуска.
 * @returns {Promise<void>}
 */
async function run(cmd, args, options) {
    console.log(`[mobile] $ ${cmd} ${args.join(' ')}`)
    await runSpawn(cmd, args, options)
}

/**
 * spawn с наследованием stdio и кодом выхода в ошибку.
 *
 * @param {string} cmd - команда.
 * @param {string[]} args - аргументы.
 * @param {object} options - опции spawn.
 * @returns {Promise<void>}
 */
async function runSpawn(cmd, args, options) {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options })
    const exitCode = await waitForExit(child)
    if (exitCode !== 0) {
        throw new Error(`Команда упала (${exitCode}): ${cmd} ${args.join(' ')}`)
    }
}

/**
 * Ожидание завершения дочернего процесса.
 *
 * @param {import('child_process').ChildProcess} child - процесс.
 * @returns {Promise<number>} код выхода.
 */
async function waitForExit(child) {
    return new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('close', resolve)
    })
}

/**
 * Поиск JDK 21: сначала JAVA_HOME, затем стандартные пути установки.
 *
 * @returns {Promise<string | null>} путь к JDK или null.
 */
async function resolveJdkHome() {
    const current = process.env.JAVA_HOME
    if (current && existsSync(current)) {
        return current
    }
    const candidates = buildJdkCandidates()
    const found = candidates.find((dir) => existsSync(dir))
    if (found) {
        console.log(`[mobile] Использую JDK: ${found}`)
        return found
    }
    return null
}

/**
 * Кандидаты путей JDK 21 на Windows/Linux/macOS.
 *
 * @returns {string[]} список директорий.
 */
function buildJdkCandidates() {
    if (process.platform === 'win32') {
        const base = 'C:\\Program Files\\Eclipse Adoptium'
        if (!existsSync(base)) {
            return []
        }
        const names = readdirSync(base)
        const matches = names.filter((name) => name.includes('21'))
        const sorted = matches.sort().reverse()
        return sorted.map((name) => join(base, name))
    }
    const unixBases = ['/usr/lib/jvm', '/opt/homebrew/opt/openjdk@21']
    const found = []
    for (const base of unixBases) {
        if (!existsSync(base)) {
            continue
        }
        const stat = statSync(base)
        if (stat.isDirectory() && base.includes('openjdk@21')) {
            found.push(base)
            continue
        }
        const names = readdirSync(base)
        const matches = names.filter((name) => name.includes('21'))
        const sorted = matches.sort().reverse()
        for (const name of sorted) {
            found.push(join(base, name))
        }
    }
    return found
}

/**
 * Поиск первого .apk в папке сборки.
 *
 * @param {string} dir - директория outputs/apk/<flavor>.
 * @returns {string | null} путь к APK.
 */
function findApk(dir) {
    if (!existsSync(dir)) {
        return null
    }
    const files = readdirSync(dir)
    const apk = files.find((name) => name.endsWith('.apk'))
    return apk ? join(dir, apk) : null
}

await main()
