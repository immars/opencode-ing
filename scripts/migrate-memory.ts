#!/usr/bin/env npx tsx
/**
 * Memory Migration Script
 *
 * Migrates existing memory files to the new session-based structure.
 * 
 * Usage:
 *   npx tsx scripts/migrate-memory.ts --dry-run    # Preview changes
 *   npx tsx scripts/migrate-memory.ts --confirm    # Execute migration
 */

import { readdir, stat, mkdir, copyFile, unlink, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { promisify } from 'util';

const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);
const mkdirAsync = promisify(mkdir);
const copyFileAsync = promisify(copyFile);
const unlinkAsync = promisify(unlink);

// Configuration
const MEMORY_ROOT = '.code-ing/memory';
const LEGACY_SESSION = 'legacy';

// Old paths (relative to project root)
const OLD_PATHS = {
  L0_DIR: `${MEMORY_ROOT}/L0`,
  L1_DIR: `${MEMORY_ROOT}/L1`,
  L2_DIR: `${MEMORY_ROOT}/L2`,
  L9_DIR: `${MEMORY_ROOT}/L9`,
  L9_FILES: {
    SOUL: 'SOUL.md',
    PEOPLE: 'PEOPLE.md',
    TASK: 'TASK.md',
    CRON: 'CRON.md',
    CRON_SYS: 'CRON_SYS.md',
  },
};

// New paths (relative to project root)
const NEW_PATHS = {
  GLOBAL_DIR: `${MEMORY_ROOT}/global`,
  SESSIONS_DIR: `${MEMORY_ROOT}/sessions`,
  LEGACY_DIR: `${MEMORY_ROOT}/sessions/${LEGACY_SESSION}`,
};

interface MigrationPlan {
  source: string;
  destination: string;
  type: 'file' | 'directory';
  action: 'copy' | 'move';
}

/**
 * Parse command line arguments
 */
function parseArgs(): { mode: 'dry-run' | 'confirm' | null } {
  const args = process.argv.slice(2);
  
  if (args.includes('--dry-run')) {
    return { mode: 'dry-run' };
  }
  if (args.includes('--confirm')) {
    return { mode: 'confirm' };
  }
  
  return { mode: null };
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath: string, basePath: string = dirPath): Promise<string[]> {
  const files: string[] = [];
  
  if (!existsSync(dirPath)) {
    return files;
  }
  
  const entries = await readdirAsync(dirPath);
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = await statAsync(fullPath);
    
    if (stats.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, basePath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Build migration plan
 */
async function buildMigrationPlan(projectDir: string): Promise<MigrationPlan[]> {
  const plans: MigrationPlan[] = [];
  
  // 1. Migrate L0 files to sessions/legacy/L0/
  const l0Dir = join(projectDir, OLD_PATHS.L0_DIR);
  if (existsSync(l0Dir)) {
    const l0Files = await getAllFiles(l0Dir);
    for (const file of l0Files) {
      const relativePath = file.substring(l0Dir.length);
      plans.push({
        source: file,
        destination: join(projectDir, NEW_PATHS.LEGACY_DIR, 'L0', basename(file)),
        type: 'file',
        action: 'move',
      });
    }
  }
  
  // 2. Migrate L1 files to sessions/legacy/L1/
  const l1Dir = join(projectDir, OLD_PATHS.L1_DIR);
  if (existsSync(l1Dir)) {
    const l1Files = await getAllFiles(l1Dir);
    for (const file of l1Files) {
      plans.push({
        source: file,
        destination: join(projectDir, NEW_PATHS.LEGACY_DIR, 'L1', basename(file)),
        type: 'file',
        action: 'move',
      });
    }
  }
  
  // 3. Migrate L2 files to sessions/legacy/L2/
  const l2Dir = join(projectDir, OLD_PATHS.L2_DIR);
  if (existsSync(l2Dir)) {
    const l2Files = await getAllFiles(l2Dir);
    for (const file of l2Files) {
      plans.push({
        source: file,
        destination: join(projectDir, NEW_PATHS.LEGACY_DIR, 'L2', basename(file)),
        type: 'file',
        action: 'move',
      });
    }
  }
  
  // 4. Migrate SOUL.md to global/SOUL.md
  const soulFile = join(projectDir, OLD_PATHS.L9_DIR, OLD_PATHS.L9_FILES.SOUL);
  if (existsSync(soulFile)) {
    plans.push({
      source: soulFile,
      destination: join(projectDir, NEW_PATHS.GLOBAL_DIR, OLD_PATHS.L9_FILES.SOUL),
      type: 'file',
      action: 'move',
    });
  }
  
  // 5. Migrate PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md to sessions/legacy/
  const sessionL9Files = [
    OLD_PATHS.L9_FILES.PEOPLE,
    OLD_PATHS.L9_FILES.TASK,
    OLD_PATHS.L9_FILES.CRON,
    OLD_PATHS.L9_FILES.CRON_SYS,
  ];
  
  for (const filename of sessionL9Files) {
    const sourceFile = join(projectDir, OLD_PATHS.L9_DIR, filename);
    if (existsSync(sourceFile)) {
      plans.push({
        source: sourceFile,
        destination: join(projectDir, NEW_PATHS.LEGACY_DIR, filename),
        type: 'file',
        action: 'move',
      });
    }
  }
  
  return plans;
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdirAsync(dirPath, { recursive: true });
    console.log(`  [CREATE DIR] ${dirPath}`);
  }
}

/**
 * Execute migration plan
 */
async function executeMigration(plans: MigrationPlan[]): Promise<void> {
  // Group by destination directory to create them first
  const destDirs = new Set<string>();
  for (const plan of plans) {
    const lastSlash = plan.destination.lastIndexOf('/');
    if (lastSlash > 0) {
      destDirs.add(plan.destination.substring(0, lastSlash));
    }
  }
  
  // Create all destination directories
  console.log('\n📁 Creating directories...');
  for (const dir of Array.from(destDirs)) {
    await ensureDir(dir);
  }
  
  // Move files
  console.log('\n📄 Moving files...');
  for (const plan of plans) {
    if (plan.action === 'move') {
      await copyFileAsync(plan.source, plan.destination);
      await unlinkAsync(plan.source);
      console.log(`  [MOVE] ${plan.source} -> ${plan.destination}`);
    }
  }
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Memory Migration Script

Usage:
  npx tsx scripts/migrate-memory.ts --dry-run    Preview migration plan
  npx tsx scripts/migrate-memory.ts --confirm    Execute migration

Flags:
  --dry-run    Show what would be migrated without making changes
  --confirm    Execute the migration (files will be moved)

Migration Paths:
  L0/*.md      -> sessions/legacy/L0/
  L1/*.md      -> sessions/legacy/L1/
  L2/*.md      -> sessions/legacy/L2/
  L9/SOUL.md   -> global/SOUL.md
  L9/PEOPLE.md -> sessions/legacy/PEOPLE.md
  L9/TASK.md   -> sessions/legacy/TASK.md
  L9/CRON.md   -> sessions/legacy/CRON.md
  L9/CRON_SYS  -> sessions/legacy/CRON_SYS.md
`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const { mode } = parseArgs();
  
  if (!mode) {
    console.error('❌ Error: Must specify either --dry-run or --confirm\n');
    printUsage();
    process.exit(1);
  }
  
  const projectDir = process.cwd();
  
  console.log('🔄 Memory Migration Script\n');
  console.log(`Project directory: ${projectDir}`);
  console.log(`Mode: ${mode === 'dry-run' ? 'DRY RUN (no changes)' : 'CONFIRM (will execute)'}\n`);
  
  // Build migration plan
  console.log('📋 Building migration plan...');
  const plans = await buildMigrationPlan(projectDir);
  
  if (plans.length === 0) {
    console.log('\n✅ No files to migrate. Memory structure may already be up to date.');
    return;
  }
  
  // Display plan
  console.log(`\n📦 Found ${plans.length} files to migrate:\n`);
  
  // Group by type for cleaner output
  const l0Plans = plans.filter(p => p.source.includes('/L0/'));
  const l1Plans = plans.filter(p => p.source.includes('/L1/'));
  const l2Plans = plans.filter(p => p.source.includes('/L2/'));
  const soulPlans = plans.filter(p => p.source.includes('SOUL.md'));
  const legacyL9Plans = plans.filter(p => 
    !p.source.includes('SOUL.md') && p.source.includes('/L9/')
  );
  
  if (l0Plans.length > 0) {
    console.log(`L0 Messages (${l0Plans.length} files):`);
    for (const plan of l0Plans) {
      const shortSrc = plan.source.replace(projectDir, '.');
      const shortDst = plan.destination.replace(projectDir, '.');
      console.log(`  ${basename(plan.source)} -> sessions/legacy/L0/`);
    }
  }
  
  if (l1Plans.length > 0) {
    console.log(`\nL1 Daily Summaries (${l1Plans.length} files):`);
    for (const plan of l1Plans) {
      console.log(`  ${basename(plan.source)} -> sessions/legacy/L1/`);
    }
  }
  
  if (l2Plans.length > 0) {
    console.log(`\nL2 Weekly Summaries (${l2Plans.length} files):`);
    for (const plan of l2Plans) {
      console.log(`  ${basename(plan.source)} -> sessions/legacy/L2/`);
    }
  }
  
  if (soulPlans.length > 0) {
    console.log(`\nGlobal Memory:`);
    for (const plan of soulPlans) {
      console.log(`  SOUL.md -> global/SOUL.md`);
    }
  }
  
  if (legacyL9Plans.length > 0) {
    console.log(`\nLegacy Session L9 Files:`);
    for (const plan of legacyL9Plans) {
      console.log(`  ${basename(plan.source)} -> sessions/legacy/`);
    }
  }
  
  // Execute or exit
  if (mode === 'dry-run') {
    console.log('\n🔍 DRY RUN COMPLETE - No changes were made.');
    console.log('Run with --confirm to execute the migration.\n');
    return;
  }
  
  if (mode === 'confirm') {
    console.log('\n⚠️  WARNING: This will MOVE files (original files will be deleted after copy).');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await executeMigration(plans);
    
    console.log('\n✅ Migration complete!\n');
    
    // Check for remaining files in L9 directory
    const l9Dir = join(projectDir, OLD_PATHS.L9_DIR);
    if (existsSync(l9Dir)) {
      const remaining = readdirSync(l9Dir);
      if (remaining.length > 0) {
        console.log(`⚠️  Note: ${remaining.length} files remain in L9 directory:`);
        for (const file of remaining) {
          console.log(`  - ${file}`);
        }
        console.log('These may be non-standard files not included in migration.\n');
      }
    }
  }
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
