/**
 * Comprehensive Python Lexer & Tokenizer for Archipelago Feature Verification
 */

export interface TokenSpan {
  type: TokenType;
  value: string;
  line: number;      // 0-indexed
  startCol: number;  // 0-indexed
  endCol: number;    // 0-indexed
}

export enum TokenType {
  Keyword,
  Operator,
  Identifier,
  String,
  Comment,
  Number,
  Punctuation,
  Whitespace,
}

export interface PythonViolation {
  itemId: number;
  itemName: string;
  token: string;
  line: number;
  startCol: number;
  endCol: number;
}

// Item ID mappings according to Items.py:
// 6700903100: Python 'if'
// 6700903101: Python 'for'
// 6700903102: Python '='
// 6700903103: Python Comparison Operators (==, !=, <, >, <=, >=)
// 6700903104: Python 'while'
// 6700903105: Python 'else'
// 6700903106: Python 'elif'
// 6700903107: Python 'match'
// 6700903108: Python '+' (+, +=)
// 6700903109: Python '-' (-, -=)
// 6700903110: Python '*' (*, *=)
// 6700903111: Python '/' (/, /=)
// 6700903112: Python '**' (**, **=)
// 6700903113: Python '//' (//, //=)
// 6700903114: Python '%' (%, %=)
// 6700903115: Python 'and'
// 6700903116: Python 'or'
// 6700903117: Python 'not'
// 6700903118: Python 'is'
// 6700903119: Python 'in'

export const PYTHON_ITEM_MAP: Record<number, string> = {
  6700903100: "Python 'if'",
  6700903101: "Python 'for'",
  6700903102: "Python '='",
  6700903103: "Python Comparison Operators",
  6700903104: "Python 'while'",
  6700903105: "Python 'else'",
  6700903106: "Python 'elif'",
  6700903107: "Python 'match'",
  6700903108: "Python '+'",
  6700903109: "Python '-'",
  6700903110: "Python '*'",
  6700903111: "Python '/'",
  6700903112: "Python '**'",
  6700903113: "Python '//'",
  6700903114: "Python '%'",
  6700903115: "Python 'and'",
  6700903116: "Python 'or'",
  6700903117: "Python 'not'",
  6700903118: "Python 'is'",
  6700903119: "Python 'in'",
};

export class PythonLexer {
  private src: string;
  private pos = 0;
  private line = 0;
  private col = 0;

  constructor(src: string) {
    this.src = src;
  }

  public tokenize(): TokenSpan[] {
    const tokens: TokenSpan[] = [];
    const len = this.src.length;

    while (this.pos < len) {
      const ch = this.src[this.pos];

      // Handle newlines
      if (ch === "\n") {
        this.pos++;
        this.line++;
        this.col = 0;
        continue;
      }
      if (ch === "\r") {
        this.pos++;
        if (this.pos < len && this.src[this.pos] === "\n") {
          this.pos++;
        }
        this.line++;
        this.col = 0;
        continue;
      }

      // Whitespace
      if (ch === " " || ch === "\t") {
        this.pos++;
        this.col++;
        continue;
      }

      // Comments: # ... until end of line
      if (ch === "#") {
        const startCol = this.col;
        const startPos = this.pos;
        while (this.pos < len && this.src[this.pos] !== "\n" && this.src[this.pos] !== "\r") {
          this.pos++;
          this.col++;
        }
        tokens.push({
          type: TokenType.Comment,
          value: this.src.slice(startPos, this.pos),
          line: this.line,
          startCol,
          endCol: this.col,
        });
        continue;
      }

      // Check for strings (including prefixes like r, u, b, f, rf, etc.)
      const stringToken = this.tryReadString();
      if (stringToken) {
        tokens.push(stringToken);
        continue;
      }

      // Numbers
      if (this.isDigit(ch) || (ch === "." && this.pos + 1 < len && this.isDigit(this.src[this.pos + 1]))) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers & Keywords
      if (this.isIdentStart(ch)) {
        tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      // Multi-character operators and delimiters
      const opToken = this.readOperatorOrPunctuation();
      if (opToken) {
        tokens.push(opToken);
        continue;
      }

      // Fallback: advance single char
      this.pos++;
      this.col++;
    }

    return tokens;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }

  private tryReadString(): TokenSpan | null {
    const startPos = this.pos;
    const startLine = this.line;
    const startCol = this.col;

    let p = this.pos;
    // Check optional prefix: r, u, b, f, rf, fr, rb, br (case-insensitive)
    let hasPrefix = false;
    const p1 = this.src.slice(p, p + 2).toLowerCase();
    const p2 = this.src.slice(p, p + 1).toLowerCase();
    if (["rf", "fr", "rb", "br"].includes(p1)) {
      p += 2;
      hasPrefix = true;
    } else if (["r", "u", "b", "f"].includes(p2)) {
      p += 1;
      hasPrefix = true;
    }

    if (p >= this.src.length) return null;
    const quoteChar = this.src[p];
    if (quoteChar !== "'" && quoteChar !== '"') {
      return null;
    }

    // Check for triple quotes
    const isTriple = this.src.slice(p, p + 3) === quoteChar.repeat(3);
    const quoteLen = isTriple ? 3 : 1;
    const targetQuote = quoteChar.repeat(quoteLen);

    // Commit reading string
    this.pos = p + quoteLen;
    this.col += (p - startPos) + quoteLen;

    while (this.pos < this.src.length) {
      if (this.src[this.pos] === "\\") {
        // Skip escape sequence
        this.pos += 2;
        this.col += 2;
        continue;
      }
      if (this.src.slice(this.pos, this.pos + quoteLen) === targetQuote) {
        this.pos += quoteLen;
        this.col += quoteLen;
        return {
          type: TokenType.String,
          value: this.src.slice(startPos, this.pos),
          line: startLine,
          startCol,
          endCol: this.col,
        };
      }
      if (this.src[this.pos] === "\n") {
        this.line++;
        this.col = 0;
        this.pos++;
      } else {
        this.pos++;
        this.col++;
      }
    }

    // Unterminated string
    return {
      type: TokenType.String,
      value: this.src.slice(startPos, this.pos),
      line: startLine,
      startCol,
      endCol: this.col,
    };
  }

  private readNumber(): TokenSpan {
    const startPos = this.pos;
    const startCol = this.col;
    while (this.pos < this.src.length && (this.isIdentPart(this.src[this.pos]) || this.src[this.pos] === ".")) {
      this.pos++;
      this.col++;
    }
    return {
      type: TokenType.Number,
      value: this.src.slice(startPos, this.pos),
      line: this.line,
      startCol,
      endCol: this.col,
    };
  }

  private readIdentifierOrKeyword(): TokenSpan {
    const startPos = this.pos;
    const startCol = this.col;
    while (this.pos < this.src.length && this.isIdentPart(this.src[this.pos])) {
      this.pos++;
      this.col++;
    }
    const val = this.src.slice(startPos, this.pos);
    const keywords = new Set([
      "if", "elif", "else", "for", "while", "match", "case",
      "and", "or", "not", "is", "in", "def", "class", "return",
      "import", "from", "as", "pass", "break", "continue", "lambda",
      "try", "except", "finally", "raise", "with", "yield", "assert"
    ]);

    return {
      type: keywords.has(val) ? TokenType.Keyword : TokenType.Identifier,
      value: val,
      line: this.line,
      startCol,
      endCol: this.col,
    };
  }

  private readOperatorOrPunctuation(): TokenSpan | null {
    const startPos = this.pos;
    const startCol = this.col;

    // 3-char operators:
    const three = this.src.slice(this.pos, this.pos + 3);
    if (["**=", "//=", "<<=", ">>="].includes(three)) {
      this.pos += 3;
      this.col += 3;
      return { type: TokenType.Operator, value: three, line: this.line, startCol, endCol: this.col };
    }

    // 2-char operators:
    const two = this.src.slice(this.pos, this.pos + 2);
    if ([
      "**", "//", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=",
      "&=", "|=", "^=", "->", ":=", "<<", ">>"
    ].includes(two)) {
      this.pos += 2;
      this.col += 2;
      return { type: TokenType.Operator, value: two, line: this.line, startCol, endCol: this.col };
    }

    // 1-char operators & punctuation:
    const one = this.src[this.pos];
    const ops = ["+", "-", "*", "/", "%", "<", ">", "=", "&", "|", "^", "~", "@"];
    const punct = ["(", ")", "[", "]", "{", "}", ":", ",", ".", ";"];

    if (ops.includes(one)) {
      this.pos++;
      this.col++;
      return { type: TokenType.Operator, value: one, line: this.line, startCol, endCol: this.col };
    }
    if (punct.includes(one)) {
      this.pos++;
      this.col++;
      return { type: TokenType.Punctuation, value: one, line: this.line, startCol, endCol: this.col };
    }

    return null;
  }
}

/**
 * Validates Python tokens against unlocked Archipelago item IDs.
 */
export function analyzePythonFeatures(
  code: string,
  unlockedItemIds: Set<number>
): PythonViolation[] {
  const lexer = new PythonLexer(code);
  const tokens = lexer.tokenize();
  const violations: PythonViolation[] = [];

  // Skip boilerplate:
  // Identify where the method definition ends (`def ...(...) -> ...:`)
  let inBoilerplate = true;
  let seenDef = false;
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (inBoilerplate) {
      if (t.type === TokenType.Keyword && t.value === "def") {
        seenDef = true;
      }
      if (seenDef) {
        if (t.type === TokenType.Punctuation && t.value === "(") {
          parenDepth++;
        } else if (t.type === TokenType.Punctuation && t.value === ")") {
          parenDepth = Math.max(0, parenDepth - 1);
        } else if (parenDepth === 0 && t.type === TokenType.Punctuation && t.value === ":") {
          // End of function signature!
          inBoilerplate = false;
        }
      }
      continue;
    }

    // Now in user code
    let requiredItemId: number | null = null;

    if (t.type === TokenType.Keyword) {
      switch (t.value) {
        case "if":
          requiredItemId = 6700903100;
          break;
        case "for":
          requiredItemId = 6700903101;
          break;
        case "while":
          requiredItemId = 6700903104;
          break;
        case "else":
          requiredItemId = 6700903105;
          break;
        case "elif":
          requiredItemId = 6700903106;
          break;
        case "match":
          requiredItemId = 6700903107;
          break;
        case "and":
          requiredItemId = 6700903115;
          break;
        case "or":
          requiredItemId = 6700903116;
          break;
        case "not":
          requiredItemId = 6700903117;
          break;
        case "is":
          requiredItemId = 6700903118;
          break;
        case "in":
          requiredItemId = 6700903119;
          break;
      }
    } else if (t.type === TokenType.Operator) {
      switch (t.value) {
        case "=":
          requiredItemId = 6700903102;
          break;
        case "<":
        case ">":
        case "<=":
        case ">=":
        case "==":
        case "!=":
          requiredItemId = 6700903103;
          break;
        case "+":
        case "+=":
          requiredItemId = 6700903108;
          break;
        case "-":
        case "-=":
          requiredItemId = 6700903109;
          break;
        case "*":
        case "*=":
          requiredItemId = 6700903110;
          break;
        case "/":
        case "/=":
          requiredItemId = 6700903111;
          break;
        case "**":
        case "**=":
          requiredItemId = 6700903112;
          break;
        case "//":
        case "//=":
          requiredItemId = 6700903113;
          break;
        case "%":
        case "%=":
          requiredItemId = 6700903114;
          break;
        // Bitshifts (>>, <<) do NOT require any items: they are not comparison operators!
        case ">>":
        case "<<":
        case ">>=":
        case "<<=":
          break;
      }
    }

    if (requiredItemId !== null && !unlockedItemIds.has(requiredItemId)) {
      violations.push({
        itemId: requiredItemId,
        itemName: PYTHON_ITEM_MAP[requiredItemId] || `Item ${requiredItemId}`,
        token: t.value,
        line: t.line,
        startCol: t.startCol,
        endCol: t.endCol,
      });
    }
  }

  return violations;
}
