var fs = require("fs") ;
var path = require("path")  
const colors = require('colors-console')
var root = path.join(__dirname, '../json') 
var clearcount = 0
// 删除目录下所有文件
function deleteFileOrDir(path){
  let files = [];
  if(fs.existsSync(path)){
      files = fs.readdirSync(path);
      files.forEach((file, index) => {
          let curPath = path + "/" + file;
          if(fs.statSync(curPath).isDirectory()){
              deleteFileOrDir(curPath); //递归删除文件夹
          } else {
              fs.unlinkSync(curPath); //删除文件
          }
      });
      // fs.rmdirSync(path);
  }
}
function statDir (obj) {
  //1. fs.stat  检测是文件还是目录
  fs.stat(obj.root, function(error, stats){
    if(error){
        console.log('文件目录不存在，需创建');
        fs.mkdir(obj.root,function(error){
          if(error){
            console.log(error);
            return false;
          }
          console.log('创建目录'+obj.root+'成功');
        })
    } else {
      // 执行清空文件命令
      if (obj.clear && !clearcount) {
        ++clearcount
        deleteFileOrDir(obj.root)
      }
    }
  })
}
function readDirAndCreateFile(obj){
    statDir(obj)
    // 写入文件
    let filePath = obj.root + '/' + obj.filename + obj.type
    fs.readFile(filePath, (err, data) => {
      fs.writeFile(filePath, obj.data, 'utf-8', function(error){
        if(error){
          console.log(error);
          return false;
        }
        console.log(colors('green', prex + obj.filename + suffix + '写入'+filePath+'成功\n'));
      })
    });
}  
// 新版swaggarjson解析
function getJson(url) {
  var http = require('http');
  var pm = new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var html = '';
      res.on('data', function (d) {
        html += d.toString()
      });
      res.on('end', function () {
        resolve(html);
      });
    }).on('error', function (e) {
      reject(e)
    });
  });
  return pm;
}
// 解析apijson
function parseInterFaceJson(val, fileName, clear) {
  var jsontxt = val;
  var json = JSON.parse(jsontxt);
  var maintitle = json.info.title;
  var obj = {}
  json.tags.map((item) => {
    obj[item.name] = {
      des: item.description,
      interface: {}
    }
  })
  for (let key in json.paths) {
    let temp = ''
    let params = []
    if (json.paths[key].get) {
      temp = obj[json.paths[key].get.tags[0]]
      temp.interface[key] = {
        type: 'get',
        fields: [],
        model: {},
        gateway: maintitle + key + ': internal,'
      }
      params = json.paths[key].get.parameters.length > 0 ? json.paths[key].get.parameters : []
    } else if (json.paths[key].post) {
      temp = obj[json.paths[key].post.tags[0]]
      temp.interface[key] = {
        type: 'post',
        fields: [],
        model: {},
        gateway: maintitle + key + ':internal,'
      }
      params = json.paths[key].post.parameters.length > 0 ? json.paths[key].post.parameters : []
    }
    params.map((item) => {
      if (item.required) {
        if (item.schema) {
          if (item.schema.type && item.schema.type == 'array') {
            temp.interface[key].model[item.name] = ''
            let fieldsObj = {
              name: item.name,
              label: item.description,
              component: 'Select',
              option: []
            }
            temp.interface[key].fields.push(fieldsObj)
          }
          if (item.schema.$ref) {
            let definekey = item.schema.$ref.substr(14, item.schema.$ref.length)
            temp.interface[key].model[definekey] = {}
            for (let pkey in json.definitions[definekey].properties) {
              temp.interface[key].model[definekey][pkey] = ''
              let componenttype = 'Input'
              switch (json.definitions[definekey].properties[pkey].type) {
                case "integer":
                  componenttype = 'Number'
                  break
                case "string":
                  componenttype = 'Input'
                  break
                case "array":
                  componenttype = 'Select'
                  break
              }
              let fieldsObj = {
                name: pkey,
                label: json.definitions[definekey].properties[pkey].description,
                component: componenttype
              }
              if (json.definitions[definekey].properties[pkey].type == 'array') {
                fieldsObj.option = []
              }
              temp.interface[key].fields.push(fieldsObj)
            }
          }
        } else {
          let componenttype = 'Input'
          switch (item.type) {
            case "integer":
              componenttype = 'Number'
              break
            case "string":
              componenttype = 'Input'
              break
            case "array":
              componenttype = 'Select'
              break
          }
          let fieldsObj = {
            name: item.name,
            label: item.description,
            component: componenttype
          }

          if (item.type == 'array') {
            fieldsObj.option = []
          }
          temp.interface[key].model[item.name] = ''
          temp.interface[key].fields.push(fieldsObj)
        }
      }
    })
  }
  // 检测目录是否存在，并创建文件
  readDirAndCreateFile({
    root: path.join(root),
    filename: fileName,
    data: JSON.stringify(obj, "", "\t"),
    clear: clear ? clear : false,
    type: '.json'
  })
  // 生成html
  // createApiJsonFileToHtml(root, fileName, clear, obj)
}
// 生成html
function createApiJsonFileToHtml (root, fileName, clear, obj) {
  // 检测目录是否存在，并创建文件
let html = `${
    Object.values(obj).map((item) => {
      return `
          ${
            Object.keys(item.interface).map((interfaceitem)=>{
              return `
                  <pre>${interfaceitem}</pre>
                  <template>
                    <div class="col-sm-12">
                      <zkt-form2
                      :fileds="fields"
                      v-model="model"
                      >
                      </zkt-form2>
                    </div>
                  <template>
                  <script>
                    export default {
                      name: '${interfaceitem}',
                      data () {
                        return {
                          fields: ${JSON.stringify(item.interface[interfaceitem].fields, "", "\t")},
                          model: ${JSON.stringify(item.interface[interfaceitem].model, "", "\t")}
                        }
                      }
                    }
                    </script>
                    <style scoped>
                    </style>`
            }).join('{||||}')
          }`
    }).join('{||||}')
  }`
  html.split('{||||}').map((item) => {
    let key = item.match(/<pre>(.*?)<\/pre>/gi)
    if (key !== null) {
      let vuefielname = key[0].replace(/<\/?pre>/gi, '').substr(1).replace(/\//gi, '-')
      console.log(vuefielname, 'vuefielname')
      readDirAndCreateFile({
        root: path.join(root).replace(/json/gi, 'vue'),
        filename: vuefielname,
        data: item.replace(/<pre>(.*?)<\/pre>/gi, ''),
        clear: clear ? clear : false,
        type: '.vue'
      })
    }
  })
}
// 配置信息
let prex = 'http://xx.xx.xx.xx:xx/'
let suffix = '/xx/xx-xx'
let apiConfig = {
  'merchant-api': 'merchant-api',
  'cms-api': 'cms-api',
}
function createApiJsonFile(obj) {
  for (let key in apiConfig) {
    getJson(prex + key + suffix)
    .then(function (d) {
      parseInterFaceJson(d, key, true)
    });
  }
}
statDir({
  root: root,
  clear: false
})
createApiJsonFile(apiConfig)
