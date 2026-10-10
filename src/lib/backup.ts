import { today } from './dates';
import { getData } from './store';

/** Download everything, private collections included, as one JSON file. */
export function exportBackup() {
  const blob = new Blob([JSON.stringify(getData(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `winterarc-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
