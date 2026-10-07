import { describe, expect, it } from 'vitest';
import { saveCurtainMessages } from './saveCurtainCopy';
import { backspace, bufferToWeight, decimalPlaceholder, pressComma, pressDigit, seedBuffer } from './weight';

describe('weight keypad (partide.captura.c4)', () => {
  it('types digits and a comma decimal', () => {
    let b = '';
    for (const d of ['1', '2']) b = pressDigit(b, d)!;
    b = pressComma(b);
    b = pressDigit(b, '5')!;
    expect(b).toBe('12,5');
    expect(bufferToWeight(b)).toBe(12.5);
  });

  it('a comma on an empty buffer starts at «0,»; a second comma is ignored', () => {
    expect(pressComma('')).toBe('0,');
    expect(pressComma('3,1')).toBe('3,1');
  });

  it('refuses a fourth decimal', () => {
    expect(pressDigit('3,125', '1')).toBeNull();
    expect(pressDigit('3,12', '1')).toBe('3,121');
  });

  it('refuses anything past 60 kg', () => {
    expect(pressDigit('6', '1')).toBeNull();
    expect(pressDigit('6', '0')).toBe('60');
    expect(pressDigit('60,', '1')).toBeNull();
    expect(pressDigit('59,9', '9')).toBe('59,99');
  });

  it('backspace walks out of the decimals; an empty buffer is «no weight»', () => {
    expect(backspace('3,')).toBe('3');
    expect(bufferToWeight('')).toBeNull();
    expect(bufferToWeight('0')).toBe(0.1);
  });

  it('seeds as typed and shows the empty decimal slots', () => {
    expect(seedBuffer(3)).toBe('3');
    expect(seedBuffer(3.25)).toBe('3,25');
    expect(seedBuffer(null)).toBe('');
    expect(decimalPlaceholder('3,')).toBe('000');
    expect(decimalPlaceholder('3,1')).toBe('00');
    expect(decimalPlaceholder('3')).toBe('');
  });
});

describe('saveCurtainMessages', () => {
  it('the photo line only when a photo is attached; edit and rod copy', () => {
    expect(saveCurtainMessages('catch')).toEqual(['Punem peștele pe cântar…', 'Notăm captura în jurnal…']);
    expect(saveCurtainMessages('catch', { hasPhoto: true })).toContain('Pregătim poza pentru album…');
    expect(saveCurtainMessages('catchEdit')).toEqual(['Actualizăm captura…', 'Punem la loc în jurnal…']);
    expect(saveCurtainMessages('rod')).toHaveLength(3);
  });
});
