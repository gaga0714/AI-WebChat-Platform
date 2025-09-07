import colors from 'picocolors';
export const startOut = () => {
  return {
    name: "startOut",
    apply: "serve",
    configureServer(server) {
      const print = server.printUrls;//先保存原本的 printUrls 方法（默认会打印服务器运行时的 URL）。
      server.printUrls = () => {
        const network=server.resolvedUrls?.network[0];
        const local=server.resolvedUrls?.local[0];
        if(!network&&!local){
            console.log(colors.red('获取ip地址失败，请检查vite.config.js中server.host配置是否正确！\n'));
        }else{
            console.info(colors.green(
`                    .-""-.                   
                   /      \                  
               _.-'\  o    |                 
         ;-.   '._._)__,   |           _..,_ 
       ,_\_ \`'._..  /      ;    .--""\`\`  __/_
       \   \`      \/       \   /       -.___/
        \`--,'     /         './      \`'-,_/  
         \`  .'  |          -'   , \`-;._/    
          \`"\`\`'-'\            '-._/--'       
                  '.              \          
                    \`\             \  )\`.-,  
                      \             \`-.   (  
                       '._                /  
                          ;\`;----.. _.--'\`   
                          / /      \ \       
                     .---' (        ) '-.    
               gaga    ).-'  \    .-'.'  |    
                      \`'-.-'\`     )_.-._/    `));
            print();
        }
      }
    }
  }
}
