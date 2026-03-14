/**
 * L9 - Long-term Memory Module
 *
 * Handles SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md
 */

import { L9_FILES } from './constants.js';
import { readMemoryRootFile, writeMemoryRootFile } from './utils.js';

type L9FileName = typeof L9_FILES[keyof typeof L9_FILES];

function readL9File(projectDir: string, filename: L9FileName): string {
  return readMemoryRootFile(projectDir, filename);
}

function writeL9File(projectDir: string, filename: L9FileName, content: string): void {
  writeMemoryRootFile(projectDir, filename, content);
}

export function readSoul(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.SOUL);
}

export function writeSoul(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.SOUL, content);
}

export function readPeople(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.PEOPLE);
}

export function writePeople(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.PEOPLE, content);
}

export function readTasks(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.TASK);
}

export function writeTasks(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.TASK, content);
}

export function readCron(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.CRON);
}

export function writeCron(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.CRON, content);
}

export function readCronSys(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.CRON_SYS);
}

export function writeCronSys(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.CRON_SYS, content);
}

export function readAllL9(projectDir: string): {
  soul: string;
  people: string;
  tasks: string;
  cron: string;
  cronSys: string;
} {
  return {
    soul: readSoul(projectDir),
    people: readPeople(projectDir),
    tasks: readTasks(projectDir),
    cron: readCron(projectDir),
    cronSys: readCronSys(projectDir),
  };
}
