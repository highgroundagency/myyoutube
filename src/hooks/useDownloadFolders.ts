import { useCallback, useState } from 'react';
import {
  loadFolders,
  rememberFolder,
  removeFolder,
  loadBase,
  saveBase,
  type DownloadFolder,
} from '../lib/downloads/folders';

/** Reactive access to the device-local list of remembered download folders. */
export function useDownloadFolders() {
  const [folders, setFolders] = useState<DownloadFolder[]>(() => loadFolders());
  const [base, setBaseValue] = useState<string>(() => loadBase());

  const remember = useCallback((name: string, path: string) => {
    setFolders(rememberFolder(name, path, new Date().toISOString()));
  }, []);

  const remove = useCallback((path: string) => {
    setFolders(removeFolder(path));
  }, []);

  const setBase = useCallback((next: string) => {
    setBaseValue(next);
    saveBase(next);
  }, []);

  return { folders, remember, remove, base, setBase };
}
