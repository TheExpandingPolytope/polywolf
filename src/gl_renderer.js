
class renderer {
    constructor(canvas_id){
        //initialize gl
        const canvas = document.getElementById(canvas_id);
        this.gl = canvas.getContext('webgl');
        if(gl == null){
            alert("Unable to initialize webgl");
        }
    }

}