import {shell} from 'electron';
import {cfgPath} from './paths';
import {Registry, loadRegistry} from '../utils/registry';
import {exec} from 'child_process';

const getUserChoiceKey = () => {
  if (!loadRegistry()) return;
  try {
    // Load FileExts keys for .js files
    const fileExtsKeys = Registry.openKey(
      Registry.HKCU,
      'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.js',
      Registry.Access.READ
    );
    const keys = fileExtsKeys ? Registry.enumKeyNames(fileExtsKeys) : [];
    Registry.closeKey(fileExtsKeys);

    // Find UserChoice key
    const userChoice = keys.find((k) => k.endsWith('UserChoice'));
    return userChoice
      ? `Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.js\\${userChoice}`
      : userChoice;
  } catch (error) {
    console.error(error);
    return;
  }
};

const hasDefaultSet = () => {
  if (!loadRegistry()) return false;
  const userChoice = getUserChoiceKey();
  if (!userChoice) return false;

  try {
    // Load key values
    const userChoiceKey = Registry.openKey(Registry.HKCU, userChoice, Registry.Access.READ)!;
    const values: string[] = Registry.enumValueNames(userChoiceKey).map(
      (x) => (Registry.queryValue(userChoiceKey, x) as string) || ''
    );
    Registry.closeKey(userChoiceKey);

    // Look for default program
    const hasDefaultProgramConfigured = values.every(
      (value) => value && typeof value === 'string' && !value.includes('WScript.exe') && !value.includes('JSFile')
    );

    return hasDefaultProgramConfigured;
  } catch (error) {
    console.error(error);
    return false;
  }
};

// This mimics shell.openItem, true if it worked, false if not.
const openNotepad = (file: string) =>
  new Promise<boolean>((resolve) => {
    exec(`start notepad.exe ${file}`, (error) => {
      resolve(!error);
    });
  });

export default () => {
  // Windows opens .js files with  WScript.exe by default
  // If the user hasn't set up an editor for .js files, we fallback to notepad.
  if (process.platform === 'win32') {
    try {
      if (hasDefaultSet()) {
        return shell.openPath(cfgPath).then((error) => error === '');
      }
      console.warn('No default app set for .js files, using notepad.exe fallback');
    } catch (err) {
      console.error('Open config with default app error:', err);
    }
    return openNotepad(cfgPath);
  }
  return shell.openPath(cfgPath).then((error) => error === '');
};
