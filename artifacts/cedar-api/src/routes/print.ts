import { Router, type IRouter } from "express";
import net from "net";

const router: IRouter = Router();

// Pre-converted logo: 360×203px, 1-bit ESC/POS GS v 0 raster image
// Source: Island Tacos logo (white art on transparent → black on white, threshold=180)
const LOGO_ESCPOS_HEX =
  "1d7630002d00cb00000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000fe" +
  "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f" +
  "ffe0000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "7ffffc0000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "01ffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0003fffffe000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "00000ffffffc007fc00000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000001ffffff007fffc00000000000000000000000000000000000000000000000000000000000000000000" +
  "000000003fffffe01fffff000000000000000000000000000000000000000000000000000000000000000000" +
  "00000000007fffffc07fffffc000000000000000000000000000000000000000000000000000000000000000" +
  "000000000000ffffff81ffffffe0000000000000000000000000000000000000000000000000000000000000" +
  "000000000f0001ffffff03fffffff00000000000000000000000000000000000000000000000000000000000" +
  "00000000000fc003fffffe07fffffff800000000000000000000000000000000000000000000000000000000" +
  "0000000000000fe003fffffe0ffffffffc000000000000000000000000000000000000000000000000000000" +
  "000000000000000ff807fffffc1ffffffffe0000000000000000000000000000000000000000000000000000" +
  "00000000000000000ffc07fffff81fffffffff00000000000000000000000000000000000000000000000000" +
  "0000000000000000000fff0fffe000007fffffff800000000000000000000000000000000000000000000000" +
  "000000000000000000000fff8ff800000001ffffff8000000000000000000000000000000000000000000000" +
  "00000000000000000000000fffff80000000001fffffc0000000000000000000000000000000000000000000" +
  "0000000000000000000000000ffff8000000000003ffffc00000000000000000000000000000000000000000" +
  "000000000000000000000000000fffc00007fffe00003fffe000000000000000000000000000000000000000" +
  "00000000000000000000000000000fff0003fffffffc000fffe0000000000000000000000000000000000000" +
  "0000000000000000000000000000000ff8003fffffffffc001fff00000000000000000000000000000000000" +
  "000000000000000000000000000000000fe001fffffffffff8007ff000000000000000000000000000000000" +
  "00000000000000000000000000000000000f800fffffffffffff001ff0000000000000000000000000000000" +
  "0000000000000000000000000000000003c00e007fffffffffffffe007f78000000000000000000000000000" +
  "000000000000000000000000000000000003f00801fffffffffffffff803ffc0000000000000000000000000" +
  "00000000000000000000000000000000000003f8000ffffffffffffffffe00ffe00000000000000000000000" +
  "0000000000000000000000000000000000000003fe001fffffffffffffffff803ff000000000000000000000" +
  "000000000000000000000000000000000000000003ff007fffffffffffffffffe01ff8000000000000000000" +
  "00000000000000000000000000000000000000000003fe01fffffffffffffffffff80ffc0000000000000000" +
  "0000000000000000000000000000000000000000000003fc07fffffffffffffffffffc03fe00000000000000" +
  "000000000000000000000000000000000000000000000003f80fffffffffffffffffffff01ff000000000000" +
  "00000000000000000000000000000000000000000000000003f03fffffffffffffffffffff80ff8000000000" +
  "0000000000000000000000000000000000000000000000000003c07fffffffffffffffffffffe07fc0000000" +
  "00000000000000000000000000000000000000000000000000000380fffffffffffffffffffffff03fe00000" +
  "0000000000000000000000000000000000000000000000000000000301fffffffffffffffffffffff81ff000" +
  "000000000000000000000000000000000000000000000000000000000203fffffffffffffffffffffffc0ff8" +
  "0000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffe07" +
  "fc0000000000000000000000000000000000000000000000000000000000001fffffffffffffffffffffffff" +
  "03fe0000000000000000000000000000000000000000000000000000000000003fffffffffffffffffffffff" +
  "ff81fe0000000000000000000000000000000000000000000000000000000000007fffffffffffffffffffff" +
  "ffffc0fe0000000000000000000000000000000000000000000000000000000000007fffffffffffffffffff" +
  "ffffffe07e000000000000000000000000000000000000000000000000000000000000ffffffffffffffffff" +
  "fffffffff07c000000000000000000000000000000000000000000000000000000000001ffffffffffffffff" +
  "fffffffffff838000000000000000000000000000000000000000000000000000000000003ffffffffffffff" +
  "fffffffffffffc10000000000000000000000000000000000000000000000000000000000007ffffffffffff" +
  "fffffffffffffffc00000000000000000000000000000000000000000000000000000000000007ffffffffff" +
  "fffffffffffffffffe0000000000000000000000000000000000000000000000000000000000000fffffffff" +
  "ffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000001fffffff" +
  "ffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000001fffff" +
  "ffffffffffffffffffffffff8000000000000000000000000000000000000000000000000000000000003fff" +
  "ffffffffffffffffffffffffffc000000000000000000000000000000000000000000000000000000000003f" +
  "ffffffffffffffffffffffffffffc00000000000000000000000000000000000000000000000000000000000" +
  "7fffffffffffffffffffffffffffffe000000000000000000000000000000000000000000000000000000000" +
  "007fffffffffffffffffffffffffffffe0000000000000000000000000000000000000000000000000000000" +
  "0000fffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000" +
  "000000fffffffffffffffffffffffffffffff000000000000000000000000000000000000000000000000000" +
  "00000001fffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000" +
  "0000000001fffffffffffffffffffffffffffffff800000000000000000000000000000000000c0000000000" +
  "000000718e01fffffffffffffffffffffffffffffff800000000000000000000000000000000000c00000000" +
  "00000000f3cf03fffffffffffffffffffffffffffffff81fffe0000000000000000000000000000300180000" +
  "0000000000000003fffffffffffffffffffffffffffffffc3fffec00000000000000000000000000033fd800" +
  "000000000001ffff83fffffffffffffffffffffffffffffffc3fffec00000000000000000000000000027fe0" +
  "00000000000001ffff83fffffffffffffffffffffffffffffffc3fffec0000000000000000000000000000ff" +
  "f000000000000001ffff87fffffffffffffffffffffffffffffffe3fffec0000000000000000000000000001" +
  "fff000000000000001ffff87fffffffffffffffffffffffffffffffe3fffee00000000000000000000000000" +
  "03fff800000000000001ffff87fffffffffffffffffffffffffffffffe3fffefe00000000000000000000000" +
  "0003fffa00000000000001ffff87fffffffffffffffffffffffffffffffe3fffefe000000000000000000000" +
  "00001fffff00000000000001ffff87fffffffffffffffffffffffffffffffe3fffefc0000000000000000000" +
  "0000001ffffe00000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee000000000000000000" +
  "0000000003fff800000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee0000000000000000" +
  "000000000003fff000000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee00000000000000" +
  "00000000000003fff000000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee000000000000" +
  "0000000000000001ffe000000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee0000000000" +
  "000000000000000001ffd800000000000001ffff8ffffffffffffffffffffffffffffffffe3fffee00000000" +
  "00000000000000000003ff9800000000000001ffff87fffffffffffffffffffffffffffffffe3fffee000000" +
  "00000000000000000000010c00000000e1820001ffff83fffffffffffffffffffffffffffffff83fffee0000" +
  "0000000000000000000000000c00000030e1860001ffff80000000000000000000000000000000003fffee00" +
  "000000000000000000000000000c0000003040021801ffff80000000040000000000000000000000003fffee" +
  "00000000000000000000000000000000000033fffc1801ffff800000000c0000000000000000000000007fff" +
  "ee0000000000000000000000000003000400001fffffc001ffff80000000effff000000000000000000007ff" +
  "ffee0000000000000000000000000007fffe000e7ffffff001ffff8000013ffffff800ffff01ff000000003f" +
  "ffffee0000000000000000000000000007fffe000efffffff801ffff800001fffffff80dffff0fffc0000000" +
  "ffffffee0000000000000000000000000007fffe0001fffffff001ffff800003fffffff83dffff3ffff00000" +
  "01ffffffee8000000000000000000000000007fffe0003fffffff001ffffc0000ffffffff83dfffffffff800" +
  "0007ffffffef8000000000000000000000000007fffe0007ffffffe001ffffc0003ffffffff80cfffffffffe" +
  "00000fffffffef8000000000000000000000000007fffe0027ffffffe001ffffc0007ffffffff800ffffffff" +
  "ff00003fffffffee0000000000000000000000000007fffe007fffffffc001ffffc000fffffffff80cffffff" +
  "ffff00007fffffffee0000000000000000000000000007fffe006fffffffc001ffffc001fffffffff81cffff" +
  "ffffff8000ffffffffee0000000000000000000000000007fffe000fffffff8001ffffc013fffffffff83cff" +
  "ffffffff8001ffffffffee0000000000000000000000000007fffe000fffffff8001ffffc01ffffffffff80c" +
  "ffffffffffc003ffffffffee0000000000000000000000000007fffe000fffffff0001ffffc00ffffffffff8" +
  "00ffffffffffc007ffffffffee0000000000000000000000000007fffe000ffffe000001ffffc01fffffffff" +
  "f804ffffffffffc00fffffffffee0000000000000000000000000007fffe0007fffe300001ffffc01fffffff" +
  "fff81cffffffffffc00fffffffffee0000000000000000000000000007fffe0007ffffb00001ffffc03fffff" +
  "fffff83cffffffffffe01fffffffffee0000000000000000000000000007fffe0007ffffc08001ffffc03fff" +
  "fffffff80cffffffffffe03fffffffffee0000000000000000000000000007ffff0003fffff1c001ffffc07f" +
  "fff07ffff800ffffffffffe03fffffffffee0000000000000000000000000007ffff0001fffffe8001ffffc0" +
  "7fffe03ffff804ffffffffffe07ffffc7fffee000000ffffffe000000000000007ffff0000ffffff0401ffff" +
  "c07fffe01ffff80efffff9ffffe07ffff87fffee000000ffffffffffffffffff8007ffff0002ffffffcc01ff" +
  "ffc07fffe01ffff81effffe0ffffe0fffff07fffee000000ffffffffffffffffffc007ffff00077fffffec01" +
  "ffffc0ffffe01ffff80effffc0ffffe0ffffe07fffee000000ffffffffffffffffffc007ffff00023ffffff0" +
  "01ffffc0ffffe03ffff800ffffc07fffe0ffffe07fffefc00000ffffffffffffffffffc007ffff00000fffff" +
  "f981ffffc0fffff03ffff800ffffc07fffe1ffffe07fffefc00000ffffffffffffffffffc007ffff000037ff" +
  "fffd81ffffc3fffff87ffff80effffc07fffe1ffffe07fffefc00000ffffffffffffffffffc007ffff003839" +
  "fffffc01ffffc3fffffffffff81effffc07fffe1fffff03fffee000000ffffffffffffffffffc007ffff003f" +
  "30fffffc01ffffc0fffffffffff01effffc07fffe1ffffffffffee000000ffffffffffffffffffc007ffff00" +
  "7fe0fffffc01ffffc0fffffffffff006ffffc07fffe1ffffffffffee000000ffffffffffffffffffc007ffff" +
  "007ffffffffc01ffffc0fffffffffff000ffffc07fffe1ffffffffffee000000ffffffffffffffffffc007ff" +
  "ff00fffffffffcc1ffffc0fffffffffff006ffffc07fffe1ffffffffffee000000ffffffffffffffffffc007" +
  "ffff00fffffffffcc1ffffc07ffffffffff01effff807fffe1ffffffffffee000000ffffffffffffffffffc0" +
  "07ffff01fffffffffc01ffffc07ffffffffff01effff807fffe1ffffffffffee000000ffffffffffffffffff" +
  "c007ffff01fffffffffc01ffffc07ffffffffff006ffff807fffe0ffffffffffee000001ffffffffffffffff" +
  "ffc007ffff03fffffffff801ffffe03ffffffffff000ffff807fffe0ffffffffffee000001ffffffffffffff" +
  "ffffc007ffff03fffffffff801ffffe03ffffffffff006ffff807fffe0ffffffffffee000001ffffffffffff" +
  "ffffffc00fffff03fffffffff301ffffe01ffffffffff00effff807fffe07fffffffffee000001ffffffffff" +
  "ffffffffc00fffff07fffffffff301ffffe01ffffffffff01effff807fffe07fffffffffefc00001ffffffff" +
  "ffffffffffc00fffff07ffffffffe001ffffe00ffffffffff006ffff807fffe03fffffffffefc00001ffffff" +
  "ffffffffffffc00fffff01ffffffff8001ffffe00ffffffffff000ffff807fffe01fffffffffefc00001ffff" +
  "ffffffffffffffc00fffff047fffffff3001ffffe011fffffbfff002ffff807fffe007ffffffffee000001ff" +
  "ffffffffffffffffc00fffff0e1ffffffc3001ffffe000ffffe3fff006ffff807fffe001ffff3fffee000001" +
  "ffffffffffffffffff800fffff0603fffff00001ffffe0003fff03fff00effff807fffe0003ff83fffee0000" +
  "01ffffffffffffffffff000fffff00303ffe0e0001ffffe00003f003fff006ffff807fffe000001807000000" +
  "0001ffffffffffffffffff0007ffff003000020e00000002000019800000000000000001ffc000003c070380" +
  "000000001ffffffffffffffe000000000000c183000000000700003c8000000001c0000000000000303e0703" +
  "80000000444023fffffffffffe000000000100c183000000000780003c0000000801c0600000000000701c02" +
  "0380c00000ce6663fffffff00000000000000300018000000000070000180000001c01c0f00000000000700f" +
  "ff0001c00000eeee73fffffff31119800000000300000000000000000000000000003c0000f0000000000031" +
  "fffffe01c00001eeee73fffffff3339980000000030000000000000001ffffe00000001c000060c000000000" +
  "0fffffffe0c00001eeeef3fffffff73bbb8000600ffffffffc00000c001ffffffc000000007ffe01e0000000" +
  "203ffffffffc000001eeeef3fffffff7bbbb800061fffffffffc00000e01fffffffc00003807ffffc1e00000" +
  "0070ffffffffff000001ceeee3ffffffffbbbb800037fffffffffc00000e07fffffffc00003c3ffffff8c000" +
  "000071ffffffffff800000ccee63ffffffff3bbb80003ffffffffffc00000e1ffffffffc000038fffffffe00" +
  "00000077ffffffffff800000ccc463ffffffff33bb8000fffffffffffc0000007ffffffffc000003ffffffff" +
  "800000000fffffffffff800000804443fffffffb333b8003fffffffffffc000001fffffffffc00000fffffff" +
  "ffc08000001fffffffffff000000000003fffffffa33310007fffffffffffc000007fffffffff8001c1fffff" +
  "ffffe1c000001fffffffffff000000000003fffffff80000001ffffffffffffc00000ffffffffff8001c3fff" +
  "fffffffbc000003ffffffffffe000000000003fffffff80000003ffffffffffffc00001ffffffffff8001cff" +
  "fffffffffdc000007ffffffffffc000000000003fffffff80000007ffffffffffffc00003ffffffffff80009" +
  "fffffffffffe00000e7ffffffffffc000000000003fffffff8000001fffffffffffffc00007ffffffffff800" +
  "03ffffffffffff00000f7ffffffffff8000000000003fffffff8000003fffffffffffffc0000fffffffffff8" +
  "0007ffffffffffff00000ffffffffffff8000000000003fffffff8000007fffffffffffffc0001ffffffffff" +
  "f8000fffffffffffff860006fffffffffff0000000000001fffffff800018ffffffffffffffc0073ffffffff" +
  "fff8030fffffffffffffcf0000fffffffffff0000000000001fffffff80000fffffffffffffffc00f3ffffff" +
  "fffff8039fffffffffffffef0000ffffffffffe0000000000001fffffff800007ffffffffffffffc0077ffff" +
  "fffffff803bfffffffffffffe60000ffffffffffe0000000000001fffffff800003ffffffffffffffc0007ff" +
  "fffffffff8013ffffffffffffff00000ffffffffffc0000000000001fffffff800007ffffffffffffffc000f" +
  "fffffffffff8007ffffffffffffff000007ffffff80080000000000001fffffff80000fffffffffffffffc00" +
  "0ffffffffffff800fffffffffffffff800007ffffff03000000000000001fffffffc0000fffffffffffffffc" +
  "001ffffffffffff800fffffffffffffff800027ffffff83800000000000001fffffffc0001ffffffffffffff" +
  "fc001ffffffffffff801fffffffffffffffc40073ffffffc7800000000000001fffffffc0001ffffffffffff" +
  "fffc003fffffffffc18001fffffffffffffffce007bfffffff3000000000000001fffffffc0003ffffffffff" +
  "fffffc003fffffffe0000039fffffff83ffffffce0031fffffffc030000000000001fffffffc0003ffffffc0" +
  "7ffffffc003fffffff0000003ffffffff00ffffffee0001ffffffff038000000000001fffffffc0003ffffff" +
  "803ffffffc007ffffffe0000003bffffffe007fffffe00000ffffffffc78000000000001fffffffc0007ffff" +
  "ff001ffffffc007ffffffc00000003ffffffc007fffffe00000fffffffff30000000000001fffffffc0007ff" +
  "ffff001ffffffc007ffffffc00000003ffffffc003ffffff000007ffffffffc0000000000001fffffffc0007" +
  "ffffff000ffffffc027ffffffc00000003ffffffc003ffffff000003fffffffff0600000000001fffffffc00" +
  "0ffffffe000ffffffc0f7ffffffc00000007ffffffc003ffffff00001dfffffffff8f00000000001fffffffc" +
  "000ffffffe000ffffffc0ffffffffc00000007ffffffc003ffffff00003cfffffffffcf00000000001ffffff" +
  "fc000fffffff000ffffffc077ffffffc00000017ffffffc003ffffff20001c7ffffffffe600000000001ffff" +
  "fffc000fffffff001ffffffc007ffffffc0000003fffffffc007ffffff7000183fffffffff000000000001ff" +
  "fffffc000fffffff001ffffffc007ffffffc0000007fffffffe007ffffff7000001fffffffff860000000001" +
  "fffffffc000fffffff803ffffffc007ffffffe0000003bfffffff00fffffff70000007ffffffffcf00000000" +
  "01fffffffc003fffffffc07ffffffc007fffffff00000003fffffff83fffffff00000033ffffffffe7000000" +
  "0001fffffffc007ffffffffffffffffc007fffffff80000003ffffffffffffffff00030078ffffffffe00000" +
  "000001fffffffc001ffffffffffffffffc007fffffffc0000003ffffffffffffffff0003e0787fffffffe000" +
  "00000001fffffffc000ffffffffffffffffc007ffffffff8000003ffffffffffffffff0007fc303ffffffff0" +
  "0000000001fffffffc000ffffffffffffffffc007ffffffffffff003ffffffffffffffff0007ff803fffffff" +
  "f00000000001fffffffc000ffffffffffffffffc003ffffffffffff001ffffffffffffffff000ffffc7fffff" +
  "fff00000000001fffffffc000ffffffffffffffffc003ffffffffffff01ffffffffffffffffe000fffffffff" +
  "fffff00000000001fffffffc000ffffffffffffffffc003ffffffffffff01ffffffffffffffffe601fffffff" +
  "fffffff38000000001fffffffc000ffffffffffffffffc001ffffffffffff01efffffffffffffffef01fffff" +
  "fffffffff78000000001fffffffc0007fffffffffffffffc00dffffffffffff000fffffffffffffffc703fff" +
  "fffffffffff38000000001fffffffc0007fffffffffffffffc01fffffffffffff0007ffffffffffffffc603f" +
  "ffffffffffffe30000000001fffffffc0007fffffffffffffffc01effffffffffff0007ffffffffffffffc00" +
  "7fffffffffffffe00000000001fffffffc0007fffffffffffffffc00cffffffffffff0003ffffffffffffff8" +
  "007fffffffffffffe00000000001fffffffc0003fffffffffffffffc0007fffffffffff0001fffffffffffff" +
  "f800ffffffffffffffc00000000001fffffffc0003fffffffffffffffc0003fffffffffff000efffffffffff" +
  "fff000ffffffffffffffc00000000001fffffffc0001fffffffffffffffc0003fffffffffff001efffffffff" +
  "ffffe001ffffffffffffff800000000001fffffffc0001fffffffffffffffc0001fffffffffff000c7ffffff" +
  "ffffffe601ffffffffffffff9c0000000000fffffffc0000fffffffffffffffc0000fffffffffff00003ffff" +
  "ffffffffcf03ffffffffffffff3c0000000000fffffff800007ffffffffffffffc00007ffffffffff00001ff" +
  "ffffffffff8f03fffffffffffffe1c0000000000fffffff800003ffffffffffffffc00003ffffffffff00000" +
  "ffffffffffff0603fffffffffffffc000000000000fffffff800003ffffffffffffffc00001ffffffffff000" +
  "03bffffffffffe0001fffffffffffff8000000000000fffffff800007ffffffffffffffc00000ffffffffff0" +
  "00079ffffffffffc0000fffffffffffff0000000000000fffffff80000c7fffffffefffffc000003ffffffff" +
  "f000038ffffffffffb80003fffffffffffe7000000000000fffffffc000083fffffff8fffffc00001dffffff" +
  "fff0000003fffffffff3c00707ffffffffff87800000000000fffffffc000000ffffffe0fffffc00001c7fff" +
  "fffff0000000ffffffffc3800781fffffffffe07000000000000fffffffc0000003fffff80fffffc00001c1f" +
  "fffffff00000063fffffff010007803ffffffff800000000000000fffffffc00000007fff800fffffc000000" +
  "03fffffff000000f07fffffc0000030303ffffff8200000000000000fffffffc000000003b0000fffffc0000" +
  "00003fffff0000000600ffffe1c0000007003ffff80700000000000000000000000000000018000000000000" +
  "000000000000000000000607fc01e0000007800000000f000000000000000000000000000000180000000000" +
  "00000000060000700000000f0000c1c00000030180001c070000000000000000000000000000001000000000" +
  "00000000000f000070000000070381c00000000003c0701c0000000000000000000000000000000010000000" +
  "0000000000000f000070000000020381e00000000001c0f01c00000000000000000000000000000000000000" +
  "0000000000000006000020000000000380c0000000000000f000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000060000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000000000";

/**
 * Strip characters that ESC/POS thermal printers can't render.
 * Munbyn ITPP905 uses Windows-1252 (Latin-1 superset) — anything
 * above U+00FF, plus common smart-punctuation, gets sanitised.
 */
function sanitizeText(str: string): string {
  return str
    // Replace common Unicode typographic chars with ASCII equivalents
    .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/\u2014/g, "-")           // em dash
    .replace(/\u2013/g, "-")           // en dash
    .replace(/\u2026/g, "...")         // ellipsis
    .replace(/\u00D7/g, "x")          // multiplication sign
    // Strip all remaining characters outside Latin-1 (U+0000–U+00FF)
    // This removes all emoji, CJK, arrows, symbols, etc.
    .replace(/[^\x00-\xFF]/g, "")
    .trim();
}

function buildEscPos(lines: { text: string; bold?: boolean; center?: boolean; size?: "normal" | "large" | "small"; divider?: boolean }[]): Buffer {
  const ESC = 0x1b;
  const GS = 0x1d;
  const chunks: Buffer[] = [];

  const cmd = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const text = (str: string) => chunks.push(Buffer.from(sanitizeText(str) + "\n", "latin1"));

  // Initialize
  cmd(ESC, 0x40);
  // Set UTF-8 code page
  cmd(ESC, 0x74, 0x10);

  // Logo: center-align, print raster image, then reset alignment + blank line
  cmd(ESC, 0x61, 0x01); // center
  chunks.push(Buffer.from(LOGO_ESCPOS_HEX, "hex"));
  cmd(ESC, 0x61, 0x00); // left
  cmd(ESC, 0x64, 0x01); // feed 1 line gap after logo

  for (const line of lines) {
    if (line.divider) {
      cmd(ESC, 0x61, 0x01); // center
      text("--------------------------------");
      continue;
    }

    // Alignment
    cmd(ESC, 0x61, line.center ? 0x01 : 0x00);

    // Bold
    cmd(ESC, 0x45, line.bold ? 1 : 0);

    // Size
    if (line.size === "large") {
      cmd(GS, 0x21, 0x11); // double width+height
    } else if (line.size === "small") {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x01); // small font
    } else {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x00);
    }

    text(line.text || "");
  }

  // Reset
  cmd(ESC, 0x61, 0x00);
  cmd(ESC, 0x45, 0);
  cmd(GS, 0x21, 0x00);
  cmd(ESC, 0x21, 0x00);

  // Feed and cut
  cmd(ESC, 0x64, 0x04); // feed 4 lines
  cmd(GS, 0x56, 0x42, 0x00); // full cut

  return Buffer.concat(chunks);
}

router.post("/print/network", async (req, res): Promise<void> => {
  const { ip, port = 9100, lines } = req.body as {
    ip: string;
    port?: number;
    lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[];
  };

  if (!ip || !lines) {
    res.status(400).json({ error: "ip and lines required" });
    return;
  }

  const data = buildEscPos(lines as Parameters<typeof buildEscPos>[0]);

  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "Connection timed out" });
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true });
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ ok: false, error: err.message });
    });
  });

  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(502).json({ ok: false, error: result.error });
  }
});

export function bridgeScriptContent(): string {
  return `#!/usr/bin/env node
// Cedar Cafe - Local Print Bridge
// ===================================
// This script runs on any computer on your local WiFi network.
// It receives print jobs from the POS and sends them to your receipt printer.
//
// Requirements: Node.js (https://nodejs.org) — no other installs needed.
//
// Usage:
//   node cedar-cafe-bridge.js
//
// Custom printer IP or port:
//   PRINTER_IP=192.168.8.195 PRINTER_PORT=9100 node cedar-cafe-bridge.js
//
// On Windows (PowerShell):
//   $env:PRINTER_IP="192.168.8.195"; node cedar-cafe-bridge.js

const http = require('http');
const net  = require('net');

const PRINTER_IP   = process.env.PRINTER_IP   || '';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const BRIDGE_PORT  = parseInt(process.env.PORT || '8765');

function sanitize(s) {
  return s
    .replace(/[\\u2018\\u2019]/g, "'").replace(/[\\u201C\\u201D]/g, '"')
    .replace(/\\u2014/g, '-').replace(/\\u2013/g, '-').replace(/\\u2026/g, '...')
    .replace(/[^\\x00-\\xFF]/g, '').trim();
}

const LOGO_HEX = '${LOGO_ESCPOS_HEX.replace(/'/g, "\\'")}';

function buildEscPos(lines) {
  const ESC = 0x1b, GS = 0x1d;
  const chunks = [];
  const cmd  = (...b) => chunks.push(Buffer.from(b));
  const text = (s)    => chunks.push(Buffer.from(sanitize(s) + '\\n', 'latin1'));

  cmd(ESC, 0x40);       // initialize
  cmd(ESC, 0x74, 0x10); // UTF-8 code page
  cmd(ESC, 0x61, 0x01); // center
  chunks.push(Buffer.from(LOGO_HEX, 'hex'));
  cmd(ESC, 0x61, 0x00); // left
  cmd(ESC, 0x64, 0x01); // 1-line gap after logo

  for (const line of lines) {
    if (line.divider) { cmd(ESC, 0x61, 0x01); text('--------------------------------'); continue; }
    cmd(ESC, 0x61, line.center ? 0x01 : 0x00);
    cmd(ESC, 0x45, line.bold   ? 1    : 0);
    if      (line.size === 'large') { cmd(GS, 0x21, 0x11); }
    else if (line.size === 'small') { cmd(GS, 0x21, 0x00); cmd(ESC, 0x21, 0x01); }
    else                            { cmd(GS, 0x21, 0x00); cmd(ESC, 0x21, 0x00); }
    text(line.text || '');
  }

  cmd(ESC, 0x61, 0x00); cmd(ESC, 0x45, 0);
  cmd(GS,  0x21, 0x00); cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x64, 0x04);       // feed 4 lines
  cmd(GS,  0x56, 0x42, 0x00); // full cut
  return Buffer.concat(chunks);
}

function sendToPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Timed out')); }, 5000);
    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(data, () => { clearTimeout(timer); socket.destroy(); resolve(); });
    });
    socket.on('error', err => { clearTimeout(timer); socket.destroy(); reject(err); });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Cedar Cafe Print Bridge OK — printer: ' + PRINTER_IP + ':' + PRINTER_PORT);
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { lines } = JSON.parse(body);
        if (!Array.isArray(lines)) throw new Error('lines must be an array');
        await sendToPrinter(buildEscPos(lines));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('[' + new Date().toLocaleTimeString() + '] Receipt printed ✓');
      } catch (err) {
        console.error('[' + new Date().toLocaleTimeString() + '] Print error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(BRIDGE_PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │   Cedar Cafe — Print Bridge         │');
  console.log('  ├─────────────────────────────────────┤');
  console.log('  │  Bridge port : http://localhost:' + BRIDGE_PORT + '  │');
  console.log('  │  Printer     : ' + PRINTER_IP + ':' + PRINTER_PORT + '       │');
  console.log('  └─────────────────────────────────────┘');
  console.log('');
  console.log('  Keep this window open while the POS is in use.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
`;
}

export default router;
