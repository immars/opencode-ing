/**
 * Tests for scripts/migrate-memory.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const TEST_DIR = join('/tmp', '.test-migrate-' + Date.now());
const MEMORY_DIR = join(TEST_DIR, '.code-ing', 'memory');

// Old paths
const OLD_L0_DIR = join(MEMORY_DIR, 'L0');
const OLD_L1_DIR = join(MEMORY_DIR, 'L1');
const OLD_L2_DIR = join(MEMORY_DIR, 'L2');
const OLD_L9_DIR = join(MEMORY_DIR, 'L9');

// New paths
const NEW_GLOBAL_DIR = join(MEMORY_DIR, 'global');
const NEW_SESSIONS_DIR = join(MEMORY_DIR, 'sessions');
const NEW_LEGACY_DIR = join(MEMORY_DIR, 'sessions', 'legacy');

/**
 * Run migration script and capture output
 */
function runMigration(mode: 'dry-run' | 'confirm', cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), 'scripts', 'migrate-memory.ts');
    const proc = spawn('npx', ['tsx', scriptPath, `--${mode}`], {
      cwd,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/**
 * Create old memory structure with test files
 */
function createOldMemoryStructure(): void {
  // Create L0 files
  mkdirSync(OLD_L0_DIR, { recursive: true });
  writeFileSync(join(OLD_L0_DIR, '2024-01-15.md'), '# L0 Messages - 2024-01-15\n\n- [10:00] user: Hello');
  writeFileSync(join(OLD_L0_DIR, '2024-01-16.md'), '# L0 Messages - 2024-01-16\n\n- [11:00] user: Hi');

  // Create L1 files
  mkdirSync(OLD_L1_DIR, { recursive: true });
  writeFileSync(join(OLD_L1_DIR, '2024-01-15.md'), '# L1 Summary - 2024-01-15\n\nDaily summary content');

  // Create L2 files
  mkdirSync(OLD_L2_DIR, { recursive: true });
  writeFileSync(join(OLD_L2_DIR, '2024-W02.md'), '# L2 Weekly Summary\n\nWeekly content');

  // Create L9 files
  mkdirSync(OLD_L9_DIR, { recursive: true });
  writeFileSync(join(OLD_L9_DIR, 'SOUL.md'), '# SOUL\n\nGlobal soul content');
  writeFileSync(join(OLD_L9_DIR, 'PEOPLE.md'), '# PEOPLE\n\nPeople memory');
  writeFileSync(join(OLD_L9_DIR, 'TASK.md'), '# TASK\n\nTask memory');
  writeFileSync(join(OLD_L9_DIR, 'CRON.md'), '# CRON\n\nCron memory');
  writeFileSync(join(OLD_L9_DIR, 'CRON_SYS.md'), '# CRON_SYS\n\nSystem cron');
}

describe('Memory Migration Script', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('--dry-run flag', () => {
    it('should show migration plan without creating files', async () => {
      createOldMemoryStructure();

      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('DRY RUN');
      expect(result.stdout).toContain('Found 9 files to migrate');

      // Should NOT create new files
      expect(existsSync(NEW_GLOBAL_DIR)).toBe(false);
      expect(existsSync(NEW_SESSIONS_DIR)).toBe(false);
      expect(existsSync(NEW_LEGACY_DIR)).toBe(false);

      // Old files should still exist
      expect(existsSync(join(OLD_L0_DIR, '2024-01-15.md'))).toBe(true);
      expect(existsSync(join(OLD_L9_DIR, 'SOUL.md'))).toBe(true);
    });

    it('should show L0 migration paths in dry-run output', async () => {
      createOldMemoryStructure();

      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.stdout).toContain('L0 Messages');
      expect(result.stdout).toContain('sessions/legacy/L0/');
    });

    it('should show L1 and L2 migration paths in dry-run output', async () => {
      createOldMemoryStructure();

      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.stdout).toContain('L1 Daily Summaries');
      expect(result.stdout).toContain('sessions/legacy/L1/');
      expect(result.stdout).toContain('L2 Weekly Summaries');
      expect(result.stdout).toContain('sessions/legacy/L2/');
    });

    it('should show SOUL.md migration to global/ in dry-run output', async () => {
      createOldMemoryStructure();

      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.stdout).toContain('Global Memory');
      expect(result.stdout).toContain('SOUL.md -> global/SOUL.md');
    });

    it('should show legacy L9 files migration in dry-run output', async () => {
      createOldMemoryStructure();

      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.stdout).toContain('Legacy Session L9 Files');
      expect(result.stdout).toContain('PEOPLE.md -> sessions/legacy/');
      expect(result.stdout).toContain('TASK.md -> sessions/legacy/');
      expect(result.stdout).toContain('CRON.md -> sessions/legacy/');
    });

    it('should handle empty memory structure', async () => {
      const result = await runMigration('dry-run', TEST_DIR);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No files to migrate');
    });
  });

  describe('--confirm flag', () => {
    it('should execute migration and move files', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Migration complete');

      // Verify SOUL.md moved to global/
      expect(existsSync(join(NEW_GLOBAL_DIR, 'SOUL.md'))).toBe(true);
      const soulContent = readFileSync(join(NEW_GLOBAL_DIR, 'SOUL.md'), 'utf-8');
      expect(soulContent).toContain('Global soul content');

      // Old SOUL.md should be removed
      expect(existsSync(join(OLD_L9_DIR, 'SOUL.md'))).toBe(false);
    });

    it('should move L0 files to sessions/legacy/L0/', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);

      // Check L0 files moved
      expect(existsSync(join(NEW_LEGACY_DIR, 'L0', '2024-01-15.md'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'L0', '2024-01-16.md'))).toBe(true);

      // Verify content preserved
      const l0Content = readFileSync(join(NEW_LEGACY_DIR, 'L0', '2024-01-15.md'), 'utf-8');
      expect(l0Content).toContain('Hello');

      // Old files should be removed
      expect(existsSync(join(OLD_L0_DIR, '2024-01-15.md'))).toBe(false);
      expect(existsSync(join(OLD_L0_DIR, '2024-01-16.md'))).toBe(false);
    });

    it('should move L1 files to sessions/legacy/L1/', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);

      // Check L1 files moved
      expect(existsSync(join(NEW_LEGACY_DIR, 'L1', '2024-01-15.md'))).toBe(true);

      // Verify content preserved
      const l1Content = readFileSync(join(NEW_LEGACY_DIR, 'L1', '2024-01-15.md'), 'utf-8');
      expect(l1Content).toContain('Daily summary content');

      // Old file should be removed
      expect(existsSync(join(OLD_L1_DIR, '2024-01-15.md'))).toBe(false);
    });

    it('should move L2 files to sessions/legacy/L2/', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);

      // Check L2 files moved
      expect(existsSync(join(NEW_LEGACY_DIR, 'L2', '2024-W02.md'))).toBe(true);

      // Verify content preserved
      const l2Content = readFileSync(join(NEW_LEGACY_DIR, 'L2', '2024-W02.md'), 'utf-8');
      expect(l2Content).toContain('Weekly content');

      // Old file should be removed
      expect(existsSync(join(OLD_L2_DIR, '2024-W02.md'))).toBe(false);
    });

    it('should move L9 files (PEOPLE/TASK/CRON/CRON_SYS) to sessions/legacy/', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);

      // Check L9 files moved to sessions/legacy/
      expect(existsSync(join(NEW_LEGACY_DIR, 'PEOPLE.md'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'TASK.md'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'CRON.md'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'CRON_SYS.md'))).toBe(true);

      // Verify content preserved
      const peopleContent = readFileSync(join(NEW_LEGACY_DIR, 'PEOPLE.md'), 'utf-8');
      expect(peopleContent).toContain('People memory');

      const taskContent = readFileSync(join(NEW_LEGACY_DIR, 'TASK.md'), 'utf-8');
      expect(taskContent).toContain('Task memory');

      // Old files should be removed
      expect(existsSync(join(OLD_L9_DIR, 'PEOPLE.md'))).toBe(false);
      expect(existsSync(join(OLD_L9_DIR, 'TASK.md'))).toBe(false);
      expect(existsSync(join(OLD_L9_DIR, 'CRON.md'))).toBe(false);
      expect(existsSync(join(OLD_L9_DIR, 'CRON_SYS.md'))).toBe(false);
    });

    it('should create destination directories', async () => {
      createOldMemoryStructure();

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);

      // Check directories created
      expect(existsSync(NEW_GLOBAL_DIR)).toBe(true);
      expect(existsSync(NEW_SESSIONS_DIR)).toBe(true);
      expect(existsSync(NEW_LEGACY_DIR)).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'L0'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'L1'))).toBe(true);
      expect(existsSync(join(NEW_LEGACY_DIR, 'L2'))).toBe(true);
    });

    it('should handle partial memory structure (only L9 files)', async () => {
      // Create only L9 directory
      mkdirSync(OLD_L9_DIR, { recursive: true });
      writeFileSync(join(OLD_L9_DIR, 'SOUL.md'), '# SOUL\n\nContent');

      const result = await runMigration('confirm', TEST_DIR);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Migration complete');

      // Verify SOUL.md moved
      expect(existsSync(join(NEW_GLOBAL_DIR, 'SOUL.md'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should exit with error when no flags provided', async () => {
      const scriptPath = join(process.cwd(), 'scripts', 'migrate-memory.ts');
      
      const result = await new Promise<{ exitCode: number }>((resolve) => {
        const proc = spawn('npx', ['tsx', scriptPath], { cwd: TEST_DIR });
        proc.on('close', (code) => {
          resolve({ exitCode: code ?? 0 });
        });
      });

      expect(result.exitCode).toBe(1);
    });
  });
});
