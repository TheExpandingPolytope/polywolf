
# Poly Wolf
  <a href="https://www.codacy.com/app/pion/turn"><img src="https://api.codacy.com/project/badge/Grade/d53ec6c70576476cb16c140c2964afde" alt="Codacy Badge"></a>

Lightweight embedded model viewer for the web.
### Install
``` npm install polywolf```
### Usage
Get started by including build in projects
```<script type='module'src="node_modules/polywolf.min.js" defer></script>```

Now, add polywolf element to document like so.
```<poly-wolf' url="MODEL_PATH" width="CANVAS_WIDTH" height="CANVAS_HEIGHT><div>```
or
```
var element = document.createElement('poly-wolf');
element.setAttribute('url', 'PATH_TO_MODEL');
element.setAttribute('height', '500');
element.setAttribute('width', '500');
document.body.appendChild(element);
```

You have created a polywolf model view. Click the play button to view your model.

### Installing Locally

Here are instructions for installing repo and working with it in your own environment.
```git clone https://github.com/TheExpandingPolytope/Polywolf.git```

Now run npm install.
```npm install```

## Built With

* [WebGL](https://www.khronos.org/webgl/) - For the rendering stuff.
* [gl-Matrix](https://github.com/toji/gl-matrix) - For the math stuff.

## Contributing

Please email me at jesseengerman@hotmail.com prior to contributing. I am open to any new ideas.

## Authors

* **Jesse Engerman (Me)** - *Initial work* - [The Expanding Polytope](https://github.com/TheExpandingPolytope)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

