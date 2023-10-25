import frontMatter from 'front-matter'
import { marked, MarkedOptions } from 'marked'
import { Plugin } from 'vite'
import { parse ,HTMLElement} from 'node-html-parser'

export interface PluginOptions {
  markedOptions?: MarkedOptions
  withOrigin?: boolean
}

export interface Metadata<TAttributes extends {} = {}> {
  attributes: TAttributes
  body: string
  outline: string[]
}

export interface Result extends Metadata {
  markdown?: string
}

class Content {
  variables: string[] = []
  #contextCode = ''

  add(content: {}): void {
    for (const name in content) {
      this.#contextCode += `const ${name} = ${JSON.stringify(content[name])}\n`
      this.variables.push(name)
    }
  }

  export(): string {
    return [this.#contextCode, `export { ${this.variables.join(', ')} }`].join('\n')
  }
}

export default (options: PluginOptions): Plugin => {
  return {
    name: 'vite-plugin-markdown',
    config() {
      marked.setOptions(options.markedOptions)
    },
    transform: (src: string, id: string) => {
      if (!id.endsWith('.md')) return null
      if (!frontMatter.test(src)) return null

      const {attributes, body} = frontMatter<Metadata>(src)

      let result: Result = {
        attributes,
        outline: [],
        body: marked.parse(body)
      }
      let outline = []
      let currentOutline = undefined
      let currentElements = []
      parse(result.body).childNodes.forEach( (v)=>{
          if(v instanceof HTMLElement &&  v.rawTagName==='h2') {
              if(currentOutline) {
                  currentOutline.body = currentElements.map(e=>e.outerHTML).join(`\n`)
                  outline.push(currentOutline)
              }
              currentOutline = 
                  {
                      title: v.text, 
                  }
              currentElements = []
              return
          }
          currentElements.push(v)
      })
      if(currentOutline) {
          currentOutline.body = currentElements.map(e=>e.outerHTML).join(`\n`)
          outline.push(currentOutline)
      }
      result.outline = outline
      if (options.withOrigin) {
        result = {
          ...result,
          markdown: body
        }
      }

      let content = new Content()
      content.add(result)

      return {
        code: `${content.export()}\n export default { ${content.variables.join(', ')} }`
        // code: `export default ${JSON.stringify(result)}`,
      }
    }
  }
}
