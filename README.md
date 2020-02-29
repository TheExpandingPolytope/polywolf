
# Poly Wolf
  <a href="https://www.codacy.com/app/pion/turn"><img src="https://api.codacy.com/project/badge/Grade/d53ec6c70576476cb16c140c2964afde" alt="Codacy Badge"></a>

Lightweight embedded model viewer for the web.
### Install
```javascript
npm install polywolf
```
### Usage
Include in project
```html
<script type='module'src="node_modules/polywolf.min.js" defer></script>
```
Create polywolf element.
```html
<poly-wolf' url="MODEL_PATH" width="CANVAS_WIDTH" height="CANVAS_HEIGHT><div>```
```
or
```javascript
var element = document.createElement('poly-wolf');
element.setAttribute('url', 'PATH_TO_MODEL');
element.setAttribute('height', '500');
element.setAttribute('width', '500');
document.body.appendChild(element);
```

### Installing Locally
```java
git clone https://github.com/TheExpandingPolytope/Polywolf.git
cd Polywolf
npm install
```

## Built With

* [WebGL](https://www.khronos.org/webgl/) - For the rendering stuff.
* [gl-Matrix](https://github.com/toji/gl-matrix) - For the math stuff.

## Contributing

Please email me at jesseengerman@hotmail.com prior to contributing. I am open to any new ideas.

## Authors

* **Jesse Engerman (Me)** - *Initial work* - [The Expanding Polytope](https://github.com/TheExpandingPolytope)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

