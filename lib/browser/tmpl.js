/*

//// How it works?


Three ways:

1. Expressions: tmpl('{ value }', data).
   Returns the result of evaluated expression as a raw object.

2. Templates: tmpl('Hi { name } { surname }', data).
   Returns a string with evaluated expressions.

3. Filters: tmpl('{ show: !done, highlight: active }', data).
   Returns a space separated list of trueish keys (mainly
   used for setting html classes), e.g. "show highlight".


// Template examples

tmpl('{ title || "Untitled" }', data)
tmpl('Results are { results ? "ready" : "loading" }', data)
tmpl('Today is { new Date() }', data)
tmpl('{ message.length > 140 && "Message is too long" }', data)
tmpl('This item got { Math.round(rating) } stars', data)
tmpl('<h1>{ title }</h1>{ body }', data)


// Falsy expressions in templates

In templates (as opposed to single expressions) all falsy values
except zero (undefined/null/false) will default to empty string:

tmpl('{ undefined } - { false } - { null } - { 0 }', {})
// will return: " - - - 0"

*/

//----------------------------------------------------------------------------------------
//if (isUndef(DEBUG)) DEBUG = false

// brackets() function
// -------------------

// Low level function for track changes to brackets.
// Parameter can be one of:
//
// RegExp - If current brackets is the default, returns the original RegExp unmodified,
//          else returns a new exx with the default brackets replaced by custom ones.
//          WARNING: new RegExp discards /i and /m flags.
// number - If number...
//          0,1 -returns the current left (0) or right (1) brackets sequence
//          2,3 -returns current left (3) or right (4) _escaped_ brackets sequence
//          4   -returns RegExp based on /\\({|})/g for match current escaped brackets
//          5   -returns RegExp based on /\\?(\{|\})/g customized for nested brackets detection

// IIFE for brackets()
var brackets = (function (defaults) {

  // cache on closure, initialized on first use and on brackets changes
  var cachedBrackets,     // current full raw brackets string, used for cache
      pairs               // [0,1] raw left-right brackets pair
                          // [2,3] escaped pair, for safe construction of custom RegExps

  var BRACKETS = /{|}/g   // match default unescaped brackets (don't use `[{}]`)


  // Helper function, recreate the cache of current/custom brackets sequences

  function updateCache(s) {
    cachedBrackets = s

    // Cache the current unescaped [0,1] and escaped [2,3] brackets characters
    // RegExp ctor throws here on syntax error of custom barckets
    pairs = s.split(' ')
            .concat(new RegExp(s.replace(/(?=[^ ])/g, '\\')).source.split(' '))

    //$ASSERT(pairs.length === 4 && pairs[0] && pairs[1],
    //  'invalid brackets `' + s + '` : sequence is [' + pairs + ']')
    //$ASSERT(pairs[0] === pairs[1],
    //  'Can\'t set identical left and right brackets')

    // chache RegExp for splitByPairs()
    // Match the current escaped brackets for substitucion.
    pairs[4] = brackets(/\\({|})/g)

    // Skips an (optional) escape char and captures the current left or right brackets.
    // Detect open js brackets, if neccessary, to allow nested unescaped brackets.
    var br = '\\\\?(' + pairs[2] + '|' + pairs[3] + ')',  // main part: `/\\?(\{|\})/`
        b1 = pairs[1],
        ba = ['{ }', '[ ]', '( )'],
        a, i, j
    // e.g. with brackets='{{ }}' works for `{{{x}}}`, `{{{\}}}`, or `{{{a:{}}}}`
    for (i = j = 0; i < 3 && (a = ba[i]) !== s; ++i) {
      if (~b1.indexOf(a[2]) && a[0] !== pairs[0])
        ba[j++] = '\\' + a[0]
    }
    if (j) br += '|(' + ba.slice(0, j).join('|') + ')'

    pairs[5] = new RegExp(br, 'g')

  }
  // end of updateCache()


  // Exposed brackets() function, with name for easy debugging and error ubication

  return function _brackets(reOrIdx) {

    // make sure we use the current setting
    var s = riot.settings.brackets || defaults

    // recreate cache if needed
    if (cachedBrackets !== s) updateCache(s)

    if (reOrIdx instanceof RegExp) {
      // it's a RegExp
      // rewrite it with current brackets (only if differ from default)
      return s === defaults ? reOrIdx :
        new RegExp(
          reOrIdx.source.replace(BRACKETS, function (b) { return pairs[(b === '}') + 2] }),
          reOrIdx.global ? 'g' : ''
        )
    }

    // else assume it is an index to the desired brackets part
    //$ASSERT(typeof reOrIdx === 'number' && reOrIdx in pairs, 'Wrong reOrIdx: ' + reOrIdx)
    return pairs[reOrIdx]

  }
  // end of _brackets() [entry point]

})('{ }')
// end of IIFE for brackets


// tmpl() function
// ---------------

// IIFE for tmpl()
var tmpl = (function () {

  var
    // match valid unescaped comments in (almost) all forms, including empty ones,
    // and comments with brackets or quoted strings inside.
    RE_COMMENTS = /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//g,

    // match single or double quoted literal strings, including empty strings
    // and embedded blank characters (\n, \r, etc).
    RE_QSTRINGS = /('|")(?:[^\1]*?[^\\]?)*?\1/g,

    // Match comment or RegExp, only the RegExp is captured
    HIDE_REGEXP = new RegExp(RE_COMMENTS.source + '|(\\/[\\s\\S]*?[^\\\\]\\/)', 'g')


  // Private function: create a template instance

  function create(str) {

    // Empty strings never get here. This function is only called for _tmpl(),
    // and _tmpl() returns falsy values before calling create().
    //$IF(!str, 'falsy str in _tmpl.create!!!')

    var rex = [],             // hidden regexp queue
        parts,
        expr

    // Hiding RegEx here avoids complications trough all code, and does not affect
    // the logic, but be carefull and don't touch the comments
    str = str.replace(HIDE_REGEXP, function (s, r) {
      if (!r) return s
      rex.push(r)
      return '\uFFF0'
    })

    // Split string to TT/Expresion parts and unescape escaped brackets.
    // It is necessary bring back the brackets before the next step,
    // for correct object literals detection
    parts = splitByPairs(str)

    // now, we have in parts[] a collection of non-null strings like this.
    // [0] : template text
    // [1] : {expression}
    // [2] : template text
    // [3] : {expression}
    // ...

    //// Create the function for get the value to be returned by the template fn

    // For <b>{ fn() }</b> eturns something like:
    // `
    // function(d) {
    //   return [
    //     "<b>",
    //     (function(v){try{v=(d.fn)()}finally{return v}}).call(d),
    //     "</b>"
    //     ].join("")
    // }
    // `
    if (parts.length === 2 && !parts[0]) {

      // Single expression (e.g. `{x}`) : generate code for the root expression
      expr = parseExpr(parts[1])

    }
    else {

      // Alternating TT/Expression parts : generate an array if necessary
      expr = parts.map(function (s, i) {

        return i & 1 ?                      // every second part is an expression

          parseExpr(s, 1) :                 // expressions here defaults to '' for falsy
                                            // values, except zero

          '"' +                             // prepare the template text as js string
            s.replace(/\r?\n|\r/g, '\\n')   // normalize & preserve EOLs
             .replace(/"/g, '\\"') +        // escape double quotes
          '"'

      })

      expr = expr.length ? '[' + expr.join(',') + '].join("")' : expr[0]

    }

    // Bring RegExps back and returns the getter fn
    return new Function('d', 'return ' + restoreMarks(expr, rex, '\uFFF0') + ';')

  }
  // end of create()


  // Private function
  // Parse _one_ `{ expression }` or `{ name: expression }`

  // Match a `className:` part of a class shorthand (`{ className: expr, ... }`)
  // \uFFF1 is for quoted strings
  var CNAME_PART = /\s*(\uFFF1|-?[_A-Za-z][\w-]*)\s*:\s*/g
    //             |1   |2    |3                 |4
    // 1. Skip initial blanks
    // 2. match[2]: literal string as indentifier(s) or...
    //    TODO: accept any character, except `\` as last character?
    // 3. match[2]: non quoted identifier.
    //    NOTE: if `-` is the first char, must be follow by one of `'_'` or `[a-z]`
    // 4. Skip colon and blanks preceding the expression-value

  function parseExpr(expr, nonull) {

    // expr must come here trimmed, with brackets in place
    //$ASSERT(expr[0] === brackets(0) && expr.slice(-1) === brackets(1),
    //  'parseExpr: missing brackets in expr: ' + expr.replace(/[\r\n\t]/, ' '))

    //// Preparation

    // TODO: strings ids to preserve quoted comments and restore class names?
    var ss = []
    expr = expr
      .replace(RE_COMMENTS, ' ')            // convert comments to ' ', even inside strings

      .replace(RE_QSTRINGS, function (s) {  // now, we can hide non empty literal strings
        if (s.length < 3) return s          //  (with length > 2)
        ss.push(s)                          // save literal with quotes and replace the
        return '\uFFF1'                     //  original with an invalid unicode char
      })

      .replace(/\s+/g, ' ').trim()          // convert blanks to spaces and compact

    //// Expression type detection

    CNAME_PART.lastIndex = 0                // prepare lastIndex for use with RegExp.exec()

    var match = CNAME_PART.exec(expr)       // search first key name of class shorthands

    expr = (match && match.index === 0) ?
      parsePairs(expr, match, ss) :         // `name:` at 0: assume class shorthand list
      wrapExpr(expr, nonull)                // no `name:` part: assume js expression


    //// Postprocessing

    for (var i = 0; i < ss.length; i++) {   // bring back saved quoted literal strings
      expr = expr.replace(/\uFFF1/, function () {
        return ss[i]
          .replace(/\n/g, '\\n')            // '\n\r' chars breaks the Function ctor
          .replace(/\r/g, '\\r')            // so these should escape
      })
    }

    return expr                             // we are done

  }
  // end of parseExpr()


  // Wrap each subexpression of `{ classname: expr }` shorthands

  function parsePairs(expr, match, ss) {

    // Object literal, return trueish keys
    // e.g.: { show: isOpen(), done: item.done } -> "show done"

    var re = /[,\(\[\{]|$/g,          // comma, open brackets, end of str
        names = [],
        tests = [],
        start = 0,
        ch

    while (match) {

      // Explicit error here for easy debugging
      if (match.index !== start) throw new Error('Can\'t parse { ' + expr + ' }')

      names.push(match[1])            // save the class name(s)

      // Search first unquoted comma closing current subexpression
      re.lastIndex = start = CNAME_PART.lastIndex

      while ((match = re.exec(expr))) {

        if ((ch = match[0]) === ',' || !ch)   // end of subexpr or str
          break
        re.lastIndex = closeIndex(expr, re.lastIndex, ch) + 1

      }

      // be debug friendly
      if (ch && ch !== ',') throw new Error('Unbalanced expression: { ' + expr + ' }')

      // wrap all conditional parts to ignore errors
      tests.push(wrapExpr(expr.substring(start, match.index)))

      // Search next pair if we are not at end of expr
      if (!ch) break
      CNAME_PART.lastIndex = start = re.lastIndex
      match = CNAME_PART.exec(expr)

    }

    // we need preserve the order of literal strings in case both, class name
    // and expression, contains literals strings.

    var i, j, v

    for (i = j = 0; i < names.length; ++i) {
      v = tests[i]

      if (names[i] === '\uFFF1') {
        names[i] = ss
          .splice(j, 1)[0]                      // get string, delete from ss[]
          .slice(1, -1)                         // unquote
          .replace(/\r?\n|\r/g, ' ').trim()     // backward compatible, eols as ' '
      }

      if (ss.length)
        j += (v.match(/\uFFF1/g) || []).length  // skip ss[] elements in expression

      // completes the getter
      tests[i] = '(' + v + ')?"' + names[i] + '":""'
    }

    return tests.length > 1 ? '[' + tests.join(',') + '].join(" ").trim()' : tests[0]

  }
  // end of parsePairs()


  // Private function
  // Generates js code to get a value from an expression, wrapped in try..finally blocks
  // to avoid breaking on errors or undefined vars.
  // The generated code will be inserted in an array, returned by parseExpr()

  var SPLIT_OBJ = /\{?\s*\}+\s*|([,{])\s*(\uFFF1|[$_A-Za-z][$\w]*)\s*:\s*/g
  //              |1           |2        |
  // 1. skip `}` or `{}` (visible in match[0])
  // 2. match[1]: start of key-value pair (`{` or `,`)
  // 3. match[2]: key name ('\uFFF2' is a quoted literal string)

  function wrapExpr(expr, nonull) {

    if (/\b[$_A-Za-z][$\w]*/.test(expr)) {      // wrap nedeed? very basic detection

      // avoid confusion with ternary colons, hide object brackets & keys
      var keys = []

      expr = expr.replace(SPLIT_OBJ, function (m, c, s) {
        keys.push(s ? (c + s + ':') : m.replace(/\s/g, ''))
        return '\uFFF3'
      })

      expr = restoreMarks(
             wrapVars(expr, nonull),            // now we can wrap vars in expression
             keys, '\uFFF3')                    //  and restore the hidden keys
    }

    return expr

  }
  // end of wrapExpr()


  var DEFGLOBAL = '"in d?d:' + (window ? 'window' : 'global') + ').',

      // match properties and parameters (open bracket) following the var name
      VAR_PASTE = /\s*(?:(\[|\()|\.\s*([$\w]+))/g,  // keep this order
      //          |1     |2     |3    |4
      // 1. Skip left blanks and match
      // 2. RegExp.$1: an open bracket ...
      // 3. or match a point, followed by
      // 4. RegExp.$2: a property name

      // match a var name
      VAR_NAMES =
      /\.\s*[$\w]+|\b(?:typeof|in|instanceof|void)[\(\s]|\btrue\b|\bfunction\s*\(|\b(?:\d*\.\d+|0[xX]\d+|\d+)(?:[eE][+-]?\d+)?\b|(\bnew\s+)?([$_A-Za-z][$\w]*)/g,
      //1         |2                                    |3       |4              |5                                             |6          |7
      // skip...
      // 1. object properties - supports blanks between dot and property name
      // 2. js keywords - supports _<keyword>()_ form (e.g. `typeof(foo)`)
      // 3. some js reserved words and properties
      // 4. anonymous functions
      // 5. number literals - supports hex and exponent
      // --
      // 6. match[1] `new` keyword for ctor (special case)
      // 7. match[2] the variable or constructor name

      // falsy values optimization
      EXP_FALSY = {
        'undefined': 1,
        'false': 1,
        'null': 1,
        'NaN': 1
      }


  // wrapVars regresa la cadena de la expresión completa

  function wrapVars(expr, nonull) {

    var ss = [],
        mvar,
        match,
        falsy

    VAR_NAMES.lastIndex = 0           // we need reset lastIndex for global RegExp with exec()

    while ((match = VAR_NAMES.exec(expr))) {

      if (!(mvar = match[2]))
        continue                                      // keep EXP_NAME.lastIndex value

      falsy = 0
      if (match[1])                                   // if have match[1], mvar is a ctor
        mvar = 'new ("' + mvar + DEFGLOBAL + mvar
      else if (EXP_FALSY[mvar]) {
        if (!nonull) continue                         // falsy with nonull returns ''
        ++falsy
      } else if (mvar !== 'this') {                   // don't test `this` with (d||global)
        mvar = '("' + mvar + DEFGLOBAL + mvar         // `this` throws w/undef properties
      }

      ss.push(RegExp.leftContext)                     // save un-wrapped left part as is
      expr = RegExp.rightContext                      // keep all at right

      if (falsy)
        ss.push('""')
      else {

        while (!expr.search(VAR_PASTE)) {             // while search === 0
          var r = RegExp,
              c = r.$1  // match[1]

          if (c) {                                    // we have brackets, split content
            var i = r.lastMatch.length,               // don't include left brackets
                j = closeIndex(expr, i, c) + 1        // find pos following close brackets

            mvar += c +                               // concat left brackets, wrapped nested
                 wrapVars(expr.slice(i, j), nonull)   //  expr, including right brackets
                                                      //  with recursion
            expr = expr.substr(j)                     // skip proccesed part
          }
          else {
            expr = r.rightContext                     // we have a chained property
            mvar += '.' + r.$2                        // add with the trimmed name
          }
        }

        ss.push(                                      // wrap the expression
          '(function(v){try{v=',
            mvar,
          '}finally{return ' + (nonull ? 'v||v===0?v:""' : 'v') + '}}).call(d)'
        )
      }

      VAR_NAMES.lastIndex = 0   // need reset again
    }

    return (ss.join('') + expr).trim()

  }
  // end of wrapVars()


  // Private function
  // Restore hidden literals stored in array to str

  function restoreMarks(str, src, mark) {

    for (var i = 0; i < src.length; ++i) {
      str = str.replace(mark, src[i])
    }

    return str

  }
  // end of restoreMarks()


  // Private function
  // Returns close bracket (`]`, `)`, `}`) position, skipping nested brackets.
  // Parameter 'start' must point to position following the open bracket.

  function closeIndex(str, ix, opench, qpos) {

    var match,
        re = opench === '[' ? /\[|\]/g :
             opench === '{' ? /\{|\}/g : /\(|\)/g

    re.lastIndex = ix
    ix = 1

    while (ix > 0 && (match = re.exec(str))) {

      if (qpos && isInQuotes(str, match.index, qpos))
        continue

      match[0] === opench ? ++ix : --ix
    }

    // if (ix) throw new Error('Unbalanced expression') // let throw to Function ctor
    return match ? match.index : str.length

  }
  // end of closeIndex()


  // Private function
  // Find the start & end positions of next comment or quoted string

  var SKIP_BLOCKS = new RegExp(RE_COMMENTS.source + '|' + RE_QSTRINGS.source, 'g')

  function isInQuotes(str, pos, qpos) {

    while (pos > qpos[1]) {                 // while the end of current quoted block is
      var qm = SKIP_BLOCKS.exec(str)        //  at left of this bracket, update
      if (qm) {
        qpos[0] = qm.index                  // left and
        qpos[1] = SKIP_BLOCKS.lastIndex -1  //  right quote pos
      } else
        qpos[0] = qpos[1] = str.length
    }

    return pos > qpos[0] && pos < qpos[1]

  }
  // end of isInQuotes()


  // Private function
  // Splits TemplateText and Expression parts.

  // Search one by one the next expression in str, and save each result by pairs as
  //  `[_templateText_], [_expression_]` in the returned array.
  // So, if str have one only expression, the result is ['', expression], and for
  //  text without expressions the result is [templateText]

  function splitByPairs(str) {

    //$IF(!str, 'falsy str in _tmpl.create!!!')

    // Split string to TT/Expresion parts, and bring escaped brackets back, this time
    // unescaped. It is necessary bring back the brackets before the next step, for
    // correct object literals detection

    // We can get a long string here, so be nice to GC and try to not re-allocate
    var b0 = brackets(0),       // `{`
        re = brackets(5),       // `/\\?({|})/g`
        rerep = brackets(4),    // `/\\({|})/g`
        pairs = [],
        start = 0,
        level = 0,
        qpos = [-1, -1],
        part = null,
        match,
        pos

    SKIP_BLOCKS.lastIndex = 0         // RegExp.exec() need this

    while ((match = re.exec(str))) {

      pos = match.index

      if (level) {

        // We are in expression, brackets inside quoted text or comments, and inner
        // brackets (by pairs) are ignored.

        if (isInQuotes(str, pos, qpos))
          continue                          // ignore all brackets in quotes

        if (match[2])
          re.lastIndex = closeIndex(str, re.lastIndex, match[2], qpos) + 1
                                            // we have one of `{[(`, find close bracket
        else if (match[1] === b0)
          ++level                           // nested open brackets, change level only

        else if (--level === 0) {           // closing, save if level 0

          if (match[0][0] === '\\')
            ++level                         // escaped barcket, don't close yet
          else
            part = str.slice(start, pos)    // ok to close
        }

      }
      else if (match[1] === b0 && b0 === match[0]) { // filter out escaped brackets

        // In level 0 (template text), first open unescaped bracket marks the
        // end of these text, preceding close brackets are ignored.

        part = str.slice(start, pos)
        ++level                       // now in expression

        // Current quoted block starts (qpos1) before the expression (pos)?
        if (qpos[0] < pos) {
          SKIP_BLOCKS.lastIndex = re.lastIndex
          qpos[1] = -1                // update in next match
        }
      }

      if (part != null) {
        start = re.lastIndex          // update start position
        pairs.push(part && part.replace(rerep, '$1'))
        part = null                   // and captured part
      }
    }

    // push remaining part, only if we have one
    if (start < str.length)
      pairs.push(str.slice(start).replace(rerep, '$1'))

    return pairs

  }
  // end of splitByPairs()


  // Exposed tmpl() function.
  // Build a template (or get it from cache), render with data

  // NOTE: Nested expressions doesn't are supported. Yo don't need escape inner brackets
  //       inside expressions, except very specific cases (i.e. non-quoted, unbalanced
  //       right brackets sequence)

  // Sutile differences in empty/blank string/expressions here:
  //   falsy values, including '', and blank strings (e.g. ' ') retuns as is.
  //   empty expressions '{ }' returns undefined (i.e. '{}' is ignored).
  //   '{ } ' returns ' ' (`{ }` is ignored).
  //
  // In this version, `\r\n` in template text out of expressions is normalized to `\n`

  var cache = {}

  return function _tmpl(str, data) {

    return str && (cache[str] || (cache[str] = create(str)))(data)

  }
  // end of _tmpl() [entry point]

})()
// end of IIFE for tmpl
