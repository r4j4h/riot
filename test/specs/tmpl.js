describe('Tmpl', function() {

  var tmpl = riot.util.tmpl,
      data = {
        yes: true,
        no: false,
        str: 'x',
        obj: {val: 2},
        arr: [2],
        x: 2,
        $a: 0,
        $b: 1,
        esc: '\'\n\\',
        fn: function(s) { return ['hi', s].join(' ') }
      },
      render = function (str) {
        return tmpl(str, data)
      }

  globalVar = 5

  it('compiles specs', function() {

    this.timeout(5000)
    //// return values

    // expressions always return a raw value
    expect(render('{ 1 }')).to.equal(1)
    expect(render('{ x }')).to.equal(2)
    expect(render('{ str }')).to.equal(data.str)
    expect(render('{ obj }')).to.equal(data.obj)
    expect(render('{ arr }')).to.equal(data.arr)
    expect(render('{ fn }')).to.equal(data.fn)
    expect(render('{ null }')).to.equal(null)
    expect(render('{ no }')).to.equal(false)
    expect(render('{ yes }')).to.equal(true)

    // templates always return a string value
    expect(render('{ 1 } ')).to.equal('1 ')
    expect(render('{ obj } ')).to.equal('[object Object] ')


    //// empty arguments

    // empty expressions equal to undefined
    expect(render()).to.be(undefined)
    expect(render('{}')).to.be(undefined)
    expect(render('{ }')).to.be(undefined)

    // empty templates equal to empty string
    expect(render('')).to.equal('')
    expect(render('{ } ')).to.equal(' ')


    //// undefined values

    // ignore undefined value errors in expressions (catch the error, and set value to undefined)
    expect(render('{ nonExistingVar }')).to.be(undefined)
    expect(render('{ !nonExistingVar }')).to.equal(true)
    expect(render('{ nonExistingVar ? "yes" : "no" }')).to.equal('no')
    expect(render('{ !nonExistingVar ? "yes" : "no" }')).to.equal('yes')

    // in templates, false and undefined values result in empty string
    expect(render(' { nonExistingVar }')).to.equal(' ')
    expect(render(' { no }')).to.equal(' ')


    //// expressions

    // expressions are just JavaScript
    expect(render('{ obj.val }')).to.equal(2)
    expect(render('{ obj["val"] }')).to.equal(2)
    expect(render('{ arr[0] }')).to.equal(2)
    expect(render('{ arr[0]; }')).to.equal(2)
    expect(render('{ arr.pop() }')).to.equal(2)
    expect(render('{ fn(str) }')).to.equal('hi x')
    expect(render('{ yes && "ok" }')).to.equal('ok')
    expect(render('{ no && "ok" }')).to.equal(false)
    expect(render('{ false || null || !no && yes }')).to.equal(true)
    expect(render('{ !no ? "yes" : "no" }')).to.equal('yes')
    expect(render('{ !yes ? "yes" : "no" }')).to.equal('no')
    expect(render('{ /^14/.test(+new Date()) }')).to.equal(true)
    expect(render('{ typeof Math.random() }')).to.equal('number')
    expect(render('{ fn("there") }')).to.equal('hi there')
    expect(render('{ str == "x" }')).to.equal(true)
    expect(render('{ /x/.test(str) }')).to.equal(true)
    expect(render('{ true ? "a b c" : "foo" }')).to.equal('a b c')
    expect(render('{ true ? "a \\"b\\" c" : "foo" }')).to.equal('a "b" c')
    expect(render('{ str + " y" + \' z\'}')).to.equal('x y z')
    expect(render('{ esc }')).to.equal(data.esc)
    expect(render('{ $a }')).to.equal(0)
    expect(render('{ $a + $b }')).to.equal(1)
    expect(render('{ this.str }')).to.equal('x')

    // global vars are supported in expressions
    expect(render('{ globalVar }')).to.equal(globalVar)

    // all comments in expressions are stripped from the output
    expect(render('{ /* comment */ /* as*/ }')).to.be(undefined)
    expect(render(' { /* comment */ }')).to.equal(' ')
    expect(render('{ 1 /* comment */ + 1 }')).to.equal(2)
    expect(render('{ 1 /* comment */ + 1 } ')).to.equal('2 ')


    //// templates

    // all expressions are evaluted in template
    expect(render('{ 1 }{ 1 }')).to.equal('11')
    expect(render('{ 1 }{ 1 } ')).to.equal('11 ')
    expect(render(' { 1 }{ 1 }')).to.equal(' 11')
    expect(render('{ 1 } { 1 }')).to.equal('1 1')

    // both templates and expressions are new-line-friendly
    expect(render('\n  { yes \n ? 2 \n : 4} \n')).to.equal('\n  2 \n')


    //// class shorthand

    // names can be single-quoted, double-quoted, unquoted
    expect(render('{ ok : yes }')).to.equal('ok')
    expect(render('{ "a" : yes, \'b\': yes, c: yes }')).to.equal('a b c')
    expect(render('{ a_b-c3: yes }')).to.equal('a_b-c3')

    // even dashed names can be unquoted
    expect(render('{ my-class: yes }')).to.equal('my-class')

    // set two classes with one expression
    expect(render('{ "a b": yes }')).to.equal('a b')

    // errors in expressions are silently catched allowing shorter expressions
    expect(render('{ loading: !nonExistingVar.length }')).to.equal('loading')

    // expressions are just regular JavaScript
    expect(render('{ a: !no, b: yes }')).to.equal('a b')
    expect(render('{ y: false || null || !no && yes }')).to.equal('y')
    expect(render('{ y: 4 > 2 }')).to.equal('y')
    expect(render('{ y: fn() }')).to.equal('y')
    expect(render('{ y: str == "x" }')).to.equal('y')
    expect(render('{ y: new Date() }')).to.equal('y')

    // even function calls, objects and arrays are no problem
    expect(render('{ ok: fn(1, 2) }')).to.equal('ok')
    expect(render('{ ok: fn([1, 2]) }')).to.equal('ok')
    expect(render('{ ok: fn({a: 1, b: 1}) }')).to.equal('ok')


    //// custom brackets

    // single character brackets
    riot.settings.brackets = '[ ]'
    expect(render('[ x ]')).to.equal(2)
    expect(render('[ str\\[0\\] ]')).to.equal('x')

    // multi character brackets
    riot.settings.brackets = '<% %>'
    expect(render('<% x %>')).to.equal(2)

    // asymmetric brackets
    riot.settings.brackets = '${ }'
    expect(render('${ x }')).to.equal(2)

    // default to { } if setting is empty
    riot.settings.brackets = null
    expect(render('{ x }')).to.equal(2)


    //// using brackets inside expressions

    // brackets in expressions can always be escaped
    expect(render('{ "\\{ 1 \\}" }')).to.equal('{ 1 }')
    expect(render('\\{ 1 }')).to.equal('{ 1 }')
    expect(render('{ "\\}" }')).to.equal('}')
    expect(render('{ "\\{" }')).to.equal('{')

    // though escaping is optional...
    expect(render('{ JSON.stringify({ x: 5 }) }')).to.equal('{"x":5}')
    expect(render('a{ "b{c}d" }e { "{f{f}}" } g')).to.equal('ab{c}de {f{f}} g')

    // for custom brackets as well:

    riot.settings.brackets = '[ ]'
    expect(render('a[ "b[c]d" ]e [ "[f[f]]" ] g')).to.equal('ab[c]de [f[f]] g')

    riot.settings.brackets = '{{ }}'
    expect(render('a{{ "b{{c}}d" }}e {{ "{f{{f}}}" }} g')).to.equal('ab{{c}}de {f{{f}}} g')

    riot.settings.brackets = '<% %>'
    expect(render('a<% "b<%c%>d" %>e <% "<%f<%f%>%>" %> g')).to.equal('ab<%c%>de <%f<%f%>%> g')

    riot.settings.brackets = null

    // ...unless you're doing something very special. escaping is still needed if:

    // - your inner brackets don't have matching closing/opening bracket, e.g. { "{" } instead of { "{ }" }
    expect(render('a{ "b\\{cd" }e')).to.equal('ab{cde')

    // - you're using asymmetric custom brackets, e.g.: ${ } instead of { }, [ ], {{ }}, <% %>
    riot.settings.brackets = '${ }'
    expect(render('a${ "b{c\\}d" }e')).to.equal('ab{c}de')
    riot.settings.brackets = null

  })

  it('compiles specs, with changes at 2015-06-27', function() {

    renderError = function (str) {
      var v = false
      try {
        tmpl(str, data)
      } catch (e) {
        v = true
      }
      return v
    }

    // FIX #744 : expressions with html not evaluated
    expect(render('{ [yes,no].join("<br>") }')).to.be('true<br>false')
    expect(render('<p foo="{ "x" }">{ [yes,no].join("<br>") }</p>')).to.be('<p foo="x">true<br></p>')
    expect(render('{ str ? "<br>" + str : "<hr>" }')).to.be('<br>x')

    // FIX #784 The shorthand syntax for class names doesn't support parentheses
    expect(render('{ primary: (obj.val === 2)  }')).to.be('primary')
    expect(render('{ ok: [1,2].length === (2) }')).to.be('ok')         // inner comma
    expect(render('{ ok: (true !== (!foo === nonExistingVar.bar.x())) }')).to.be('ok')  // nested vars
    expect(render('{ ok: ((this.obj.val === 2) && ((this.str) !== "@"))  }')).to.be('ok') // using this

    //// return values

    // expressions always return a raw value
    expect(render('{ 0 }')).to.be(0)
    expect(render('{ void 0 }')).to.be(undefined)
    expect(render('{ 1/**/ /*/* */ }')).to.be(1)        // comment detection

    // templates always return a string value
    expect(render(' ')).to.be(' ')                      // preserve template text "as is"
    expect(render('\\{ }')).to.be('{ }')                // ignore closing brackets in templates
    expect(render('/* */')).to.be('/* */')              // comments in templates

    //// empty arguments

    // empty expressions equal to undefined
    expect(render('{ /**/ /*/* */ }')).to.be(undefined) // full comment detection

    //// undefined values

    // in templates, falsy values result in empty string, except zero
    expect(render(' { undefined }')).to.be(' ')    // undefined keyword support
    expect(render(' { void 0 }')).to.be(' ')       // void 0 is undefined
    expect(render(' { false }')).to.be(' ')        // js literals
    expect(render(' { null }')).to.be(' ')         // js literals
    expect(render(' { NaN }')).to.be(' ')          // js literals
    expect(render(' { 0 }')).to.be(' 0')           // falsy value zero as zero

    //// comments

    // in template text, all comments are preserved
    expect(render('/* */{ /* */ }/**/')).to.be('/* *//**/')
    expect(render('/* {"x"} *//**/')).to.be('/* x *//**/')
    expect(render('/**/ /*/**/')).to.be('/**/ /*/**/')              // full comment detection

    // in expressions, comments are converted to whitespace (in compliance with js spec)
    // riot has empty and exotic comments detection
    expect(render('{ /**/ }')).to.be(undefined)                     // empty comment
    expect(render('{ /* /\\* /* *\\/ */ }')).to.be(undefined)       // exotic comment :)
    expect(render('{ typeof/**/str === "string" }')).to.be(true)    // now this is valid js

    // @riot restriction: comments inside quoted strings in expressions are converted, too
    expect(render('{ "a" + "/*b*/" + "c" }')).to.be('a c')
    // @workaround: escape the comment
    expect(render('{ "a" + "/\\*b*/" + "c" }')).to.be('a/*b*/c')    // works, but
    expect(render('{ "a" + "/\\*b*\\/" + "c" }')).to.be('a/*b*/c')  // this is better

    //// class shorthand

    // working?
    expect(render('{ "c:\\\\" }')).to.be('c:\\')
    expect(render('{ ({ u: "c:\\\\" }).u }')).to.be('c:\\')

    // even dashed names can be unquoted
    expect(render('{ _: yes }')).to.be('_')               // '_' is a valid w3c prefix
    expect(render('{ -A1: yes }')).to.be('-A1')           // '-' prefix must followed by [_a-z]
    expect(render('{ -_: yes }')).to.be('-_')             // '-' prefix must followed by [_a-z]

    // @riot restriction: only ascii characters in unquoted names
    expect(renderError('{ á: yes }')).to.be(true)
    // @workaround: use support for unicode quoted names
    expect(render('{ "á": yes }')).to.be('á')
    expect(render('{ "\u00AE": yes }')).to.be('\u00AE')
    expect(render('{ "\\"a b\\"": yes }')).to.be('"a b"') // w3c: quoted space as ident char

    // invalid w3c identifiers
    expect(renderError('{ -1A: yes }')).to.be(true)    // '-' prefix must followed by [_a-z]
    expect(renderError('{ --A: yes }')).to.be(true)    // '-' prefix must followed by [_a-z]
    expect(renderError('{ 1A: yes }')).to.be(true)     // can't start with a digit

    // errors in expressions are silently catched allowing shorter expressions
    // @riot restriction: You don't have TypeErrors in expressions
    data.arr = []
    expect(render('{ ok: arr.slice(0)[0] }')).to.be('')       // undefined
    data.arr = null
    expect(render('{ ok: arr.slice(0)[0] }')).to.be('')       // TypeError
    data.arr = [10]
    expect(render('{ ok: arr[0].getDate() < 5 }')).to.be('')  // TypeError
    data.arr = [2]
    // @workaround: make no mistakes :)

    // new lines in templates

    // mac/win eols (cr/crlf) are normalized to lf in the template text
    expect(render('\r\n\n { 1\r\n } \r\r\n')).to.be('\n\n 1 \n\n')

    // @riot restriction: mac/win eols are normalized even in quoted template text
    //                    usually, this is what you want
    expect(render('<p style="top:0;\rleft:0\r\n"></p>')).to.be('<p style="top:0;\nleft:0\n"></p>')
    // @workaround: use literal scape char
    expect(render('<p js="\\r\\n"></p>')).to.be('<p js="\r\n"></p>')    // valid html?

    // new lines expressions & shorthands

    // blank chars '\r' and '\n' inside expressions are converted to one space
    expect(render('{\n yes \r\n ? 1\n : 0}')).to.be(1)
    expect(render('{ yes\n||\r\n\nno\r }')).to.be(true)
    expect(render(' { ok: yes\n||\r\n\nno\r } ')).to.be(' ok ')
    expect(render(' { ok:\r\ntypeof\r0\n === "number" } ')).to.be(' ok ')

    // ...but preserved in quoted strings inside expressions
    expect(render('{ ok: "\r\n".length === 2 }')).to.be('ok')
    expect(render('{ "y\ne\r\n\ns\r" }')).to.be('y\ne\r\n\ns\r')
    // ...(i.e. you can use escaped or unescaped eols)
    expect(render('{ "y\ne\\r\\n\\ns\r" }')).to.be('y\ne\r\n\ns\r')

    // ...except in shorthand names, where eols are normalized and converted to spaces
    //    without compactation **on inner spaces**, avoiding braking changes
    expect(render('{ "a\nb\r\nc\n\nd\re": yes }')).to.be('a b c  d e')  // note double space
    expect(render('{ "\n a\nb\rc \r\n": yes }')).to.be('a b c')         // trimmed

    //// brackets in templates

    // in template text, the first unescaped left bracket starts an expression,
    // the preceding right brackets, even unescaped, are ignored
    expect(render('\\{ } \\} { "0" } }')).to.be('{ } } 0 }')
    expect(render('{ } \\} { "0" } { }')).to.be(' } 0 ')

    //// brackets in expressions

    // brackets inside quoted strings in expressions are simple characters
    expect(render('a{ "b{cd" }e')).to.be('ab{cde')
    expect(render('a{ "b}cd" }e')).to.be('ab}cde')

    // in expressions, most inner brackets need not to be escaped
    expect(render('{{}}')).to.eql({})
    expect(render('{{str: "s", num:{}}}')).to.eql({ str: 's', num: {} })
    expect(render(' {{ a:1 }+{}}')).to.be(' [object Object][object Object]')
    expect(render('{ function(){} }')).to.be.an('function')

    // ...even with custom brackets
    riot.settings.brackets = '[ ]'
    expect(render('[ str[0] ]')).to.be('x')
    expect(render('[ [1][0] ]')).to.be(1)
    expect(render('a,[["b","c"]],d')).to.be('a,b,c,d')

    riot.settings.brackets = '<% %>'
    expect(render('.<% "<% %>" %>. <% ".%> <%." %>')).to.be('.<% %>. .%> <%.')
    expect(render('<% "<%= 0 %>" %>')).to.be('<%= 0 %>')

    data.arr = [2]
    riot.settings.brackets = '[[ ]]'
    expect(render('obj=[[arr[0]]]')).to.be('obj=2')

    riot.settings.brackets = '(( ))'
    expect(render('obj=((arr.pop()))')).to.be('obj=2')

    riot.settings.brackets = '{{ }}'
    expect(render('a{{ "b{{c}}d" }}e {{ "{f{{f}}}" }} g')).to.be('ab{{c}}de {f{{f}}} g')

    expect(render('obj={{{}}}')).to.be('obj=[object Object]')
    expect(render('obj={{{a:{b:0}}}}')).to.be('obj=[object Object]')

    riot.settings.brackets = '([ ])'
    expect(render('([ [].concat([0]) ])')).to.be.an('array')
    expect(render('([([1])[0]])')).to.be(1)

    //// asymmetric brackets

    // using asymmetric custom brackets, e.g.: ${ } instead of { }, [ ], {{ }}, <% %>
    riot.settings.brackets = '${ }'
    expect(render('a${ "b{c}d" }e')).to.be('ab{c}de')
    expect(render('a${{}}e')).to.be('a[object Object]e')
    expect(render('a${{\\}}e')).to.be('a[object Object]e')

    riot.settings.brackets = '${{ }}'
    expect(render('a${{{a: {}}}}e')).to.equal('a[object Object]e')
    expect(render('a${{{ a: {} }}}e')).to.equal('a[object Object]e')
    expect(render('a${{ {a: {}} }}e')).to.equal('a[object Object]e')
    expect(render('a${{{ a: {\\}}}}e')).to.equal('a[object Object]e')
    expect(render('a${{{ a: {\\}} }}e')).to.equal('a[object Object]e')

    riot.settings.brackets = '{{ }'                       // silly, but valid
    expect(render('{{{ }}')).to.eql({})
    expect(render('{{{ \\}}')).to.eql({})

    // @riot restriction: silly asymmetric brackets as `{ }}`, `[ ]]`, or `( ))` don't
    // works with the following expressions, even escaped
    riot.settings.brackets = '[ ]]'
    expect(renderError('[str[0]]]')).to.be(true)          // Sintax error
    expect(renderError('[str[0\\]]]')).to.be(true)
    // @workaround: use space
    //expect(render('[str[0] ]]')).to.be(str[0])          // TODO: do work this
    //expect(render('[ str[0] ]]')).to.be(str[0])         //  and this -left bracket is the prob

    // riot have backward compatible support for escaped brackets
    riot.settings.brackets = null
    expect(render('{ \\{ \\} }')).to.be.an('object')
    expect(render('{\\{\\}}')).to.be.an('object')
    expect(render('{{\\}}')).to.be.an('object')           // unbalanced escaped brackets
    expect(render('{\\{}}')).to.be.an('object')           // unbalanced escaped brackets

    // ...and in template text
    expect(render('\\{ { "\\{" } \\}')).to.be('{ { }')
    expect(render('\\{\\}{ /**/ }')).to.be('{}')

    riot.settings.brackets = null

    // consistency?
    expect(render('{ ok: !nonExistingVar.test(foo === !bar) }')).to.equal('ok')
    expect(render('{ !nonExistingVar.test(foo === !bar) ? "ok" : "" }')).to.equal('ok')

    expect(render('{ ok: !nonExistingVar, bar: bar }')).to.equal('ok')
    expect(render('{ [!nonExistingVar ? "ok" : "", bar ? "bar" : ""].join(" ").trim() }')).to.equal('ok')

    // brackets RegEx generation and info, discards /im, escape each char in regexp
    !(function testBrackets(brfn) {
        var vals = [
        // custom pair, brackets(/{ }/g), brackets(5)
          ['<% %>',     /\<\% \%\>/g,     /\\?(\<\%|\%\>)/g        ],
          ['·ʃ< ]]',    /\·\ʃ\< \]\]/g,   /\\?(\·\ʃ\<|\]\])|(\[)/g ],
          ['{$ $}',     /\{\$ \$\}/g,     /\\?(\{\$|\$\})|(\{)/g   ],
          ['${ }',      /\$\{ \}/g,       /\\?(\$\{|\})|(\{)/g     ],
          ['_( )_',     /\_\( \)\_/g,     /\\?(\_\(|\)\_)|(\()/g   ],
          ['// \\\\',   /\/\/ \\\\/g,     /\\?(\/\/|\\\\)/g        ],
          ['/ \\',      /\/ \\/g,         /\\?(\/|\\)/g            ]
        ]
        var re = /{ }/gim,    // default brackets
            bb,
            i

        riot.settings.brackets = undefined  // use default brackets
        for (i = 0; i < 2; i++) {
          expect(brfn(re)).to.be(re)
          expect(brfn(0)).to.equal('{')
          expect(brfn(1)).to.equal('}')
          expect(brfn(2)).to.equal('\\{')
          expect(brfn(3)).to.equal('\\}')
          expect(brfn(4)).to.eql(/\\({|})/g)
          expect(brfn(5)).to.eql(/\\?(\{|\})/g)
          expect(brfn(6)).to.be(undefined)
          riot.settings.brackets = '{ }'    // same as defaults
        }
        for (i = 0; i < vals.length; i++) {
          // set another brackets
          bb = (riot.settings.brackets = vals[i][0]).split(' ')
          expect(brfn(re).source).to.equal(vals[i][1].source)
          expect(brfn(0)).to.equal(bb[0])
          expect(brfn(1)).to.equal(bb[1])
          expect(brfn(5)).to.eql(vals[i][2])
        }
        riot.settings.brackets = null
      }
    )(riot.util.brackets)
  })

})
