function GetCubes(group) {
    var cubes = [];

    group.forEach(element => {
        if (element.type == "group") {
            cubes = cubes.concat(GetCubes(element.children));
        }
        else {
            if (element.visibility) {
                cubes.push(element);
            }
        }
    });
    return cubes;
}

function GetDisplayCubes() {
    var displayCubes = [];
    var cubes = GetCubes(Outliner.root)
    cubes.forEach(element => {
        var matrixInv = new THREE.Matrix4;
        matrixInv.copy(element.mesh.matrixWorld);

        var size = element.size();
        matrixInv.scale(new THREE.Vector3(size[0], size[1], size[2]));
        matrixInv.transpose();


        var cube = new DisplayCube();
        cube.Cube = element;
        cube.Matrix = matrixInv.toArray();
        displayCubes.push(cube)
    });
    return displayCubes;
}

function DisplayCubesToItem(scale, itemMaterial, itemName) {
    let displayArr = GetDisplayCubes();
    let PublicBukkitValues = "";
    let cubeNum = 1;
    displayArr.forEach(display => {
        let offset = display.Cube.getGlobalVertexPositions()[6];

        display.Matrix[3] = offset[0];
        display.Matrix[7] = offset[1];
        display.Matrix[11] = offset[2];
        display.Matrix[15] = scale;

        for (let i = 1; i < 17; i++) {
            //matrix
            //<cubenum>c<matrixval>m
            PublicBukkitValues += "\"hypercube:" + cubeNum + "c" + i + "m\":" + display.Matrix[i - 1].toFixed(2) + ",";

            if (display.Cube.name.includes("[")) {
                blockid = display.Cube.name.split("[")[0];
                blocktags = display.Cube.name.split("[")[1].replace("]", "");
            }
            else {
                blockid = display.Cube.name;
                blocktags = "";
            }
            //material
            //<cubenum>m
            PublicBukkitValues += "\"hypercube:" + cubeNum + "m\":\"" + blockid + "\",";
            //blocktags
            //<cubenum>t
            if (blocktags) {
                PublicBukkitValues += "\"hypercube:" + cubeNum + "t\":\"" + blocktags + "\",";
            }
        }
        cubeNum++;
    });
    PublicBukkitValues += "\"hypercube:cubecount\":" + displayArr.length.toFixed(2) + ",";

    PublicBukkitValues = "{" + PublicBukkitValues + "}";
    return "{count: 1, components: {\"minecraft:custom_name\": " + formatName(itemName) + ",\"minecraft:custom_data\": {PublicBukkitValues: " + PublicBukkitValues + "}}, id: \"minecraft:" + itemMaterial + "\"}";
}

function exportAnims(scale, animationNames, itemMaterial, itemName) {
    let displayArr = GetDisplayCubes();
    let prevAnim = Animation.selected;

    Timeline.pause();
    let origTime = Timeline.time;

    let animationitems = [];

    let animations = [];
    Animation.all.forEach(animation => {
        if (animationNames.includes(animation.name)) {
            animations.push(animation);
        }
    });

    animations.forEach(animation => {
        animation.select();

        let keyframePositions = [];
        for (let id in animation.animators) {

            let boneAnimator = animation.animators[id];
            if (!(boneAnimator instanceof BoneAnimator)) continue;


            if (boneAnimator.keyframes.length == 0) {
                continue;
            }
            boneAnimator.keyframes.forEach(key => {
                if (!keyframePositions.includes(key.time)) {
                    keyframePositions.push(key.time);
                }
            });
        }
        keyframePositions.sort();

        let PublicBukkitValues = "";
        let frame = 1;
        let prevtime = 0;

        keyframePositions.forEach(time => {
            Timeline.setTime(time, true)
            Animator.preview();

            for (let cubenum = 1; cubenum < displayArr.length + 1; cubenum++) {
                let display = displayArr[cubenum - 1];

                let offset = display.Cube.getGlobalVertexPositions()[6];

                var matrixInv = new THREE.Matrix4;
                matrixInv.copy(display.Cube.mesh.matrixWorld);

                var size = display.Cube.size();
                matrixInv.scale(new THREE.Vector3(size[0], size[1], size[2]));
                matrixInv.transpose();
                matrix = matrixInv.toArray();

                matrix[3] = offset[0];
                matrix[7] = offset[1];
                matrix[11] = offset[2];
                matrix[15] = scale;
                for (let i = 1; i < 17; i++) {
                    //animation frame matrix
                    //<cubenum>c<frame>f<matrixval>m

                    //Matrix cant be the same multiple frames in a row, to prevent a DF bug

                    if (i == 4) {
                        PublicBukkitValues += "\"hypercube:" + cubenum + "c" + frame + "f" + i + "m\":" + (+matrix[i - 1].toFixed(2) + frame / 100) + ",";
                    }
                    else {
                        PublicBukkitValues += "\"hypercube:" + cubenum + "c" + frame + "f" + i + "m\":" + matrix[i - 1].toFixed(2) + ",";
                    }
                }
            }

            let interpolation = (time - prevtime) * 20;
            PublicBukkitValues += "\"hypercube:" + frame + "fi\":" + interpolation.toFixed(2) + ",";
            frame++;
            prevtime = time;
        });
        frame--;

        PublicBukkitValues += "\"hypercube:framecount\":" + frame.toFixed(2) + ",";
        PublicBukkitValues += "\"hypercube:cubecount\":" + displayArr.length.toFixed(2) + ",";

        PublicBukkitValues = "{" + PublicBukkitValues + "}";
        animationitems.push("{count: 1, components: {\"minecraft:custom_name\": " + formatName(itemName + "." + animation.name) + ",\"minecraft:custom_data\": {PublicBukkitValues: " + PublicBukkitValues + "}}, id: \"minecraft:" + itemMaterial + "\"}");
    });

    if (prevAnim) {
        prevAnim.select();
    }
    Timeline.setTime(origTime);
    Animator.preview();

    return animationitems;
}

const sleep = ms => new Promise(res => setTimeout(res, ms))

function SendModelItems(items) {
    var webSocket = new WebSocket("ws://localhost:31375");

    webSocket.onerror = function () {
        let options =
        {
            title: "Exporting Error",
            icon: "error",
            message: "Failed to export templates. \n\rEither Minecraft isn't running or you don't have CodeClient installed with the API enabled.",
            width: 700
        }
        Blockbench.showMessageBox(options);
    }

    webSocket.onopen = () => {
        items.forEach(item => {
            webSocket.send("give " + item);
            sleep(500);
        });
        webSocket.close();
    };
}

function formatName(name) {
    let wordlist = [...name.matchAll(/\\?<\w+>|[^\\<]+|[\\<]+/g)];
    let formattedtext = `'{"extra":[`;
    let segment = "";

    for (let i = 0; i < wordlist.length; i++) {
        let word = wordlist[i][0];

        if (word[0] == '<') {
            formattedtext += '"' + segment + '",';
            segment = "";
            if (i + 1 < wordlist.length) {
                word = word.replace(/<|>/g, '')
                formattedtext += `{"color":"${word}","text":"${wordlist[i + 1]}"},`;
                i++;
            }
        } else {
            word = word.replace("\\<", "<");
            word = word.replace("\\", "\\\\\\\\");
            segment += word;
        }
    }
    formattedtext += '"' + segment + '"';
    formattedtext += `],"italic":false,"text":""}'`;
    return formattedtext;
}

function showExportDialog() {
    var exportDialog = new Dialog({
        id: "df_export_options",
        title: "DF model exporter",
        form: {
            modelname: {
                label: "model name",
                description: "The name of the model, this will be used for the function name to spawn it.",
                type: "text",
                value: Project.name
            },
            itemmaterial: {
                label: "item material",
                description: "The material of the model item",
                type: "text",
                value: "ender_eye"
            },
            scale: {
                label: "model scale",
                description: "A scale of 1 means 1 unit is 1 pixel, scale 16 means 1 unit is a full block.",
                type: "number",
                value: 1
            },
            includebase: {
                label: "include base templates",
                description: "Base templates are the ones that every model uses to render or animate.",
                type: "checkbox",
                value: false
            }
        },
        onConfirm: function (formData) {
            this.hide();

            let scale = (16 / formData.scale);

            let items = [];
            items.push(DisplayCubesToItem(scale, formData.itemmaterial, formData.modelname));

            if (selectedAnims.length > 0) {
                let animationItems = exportAnims(scale, selectedAnims, formData.itemmaterial, formData.modelname);
                items.push(...animationItems);
            }

            if (formData.includebase) {
                items.push(`{count: 1, components: {"minecraft:custom_name": '{"extra":[{"bold":true,"color":"aqua","italic":false,"obfuscated":false,"strikethrough":false,"text":"Function ","underlined":false},{"bold":false,"color":"dark_aqua","italic":false,"text":"» "},{"clickEvent":{"action":"open_url","value":"http://BBM.SpawnModel"},"color":"aqua","italic":false,"text":"BBM.SpawnModel"},{"color":"aqua","italic":false,"text":""}],"text":""}', "minecraft:custom_data": {PublicBukkitValues: {"hypercube:codetemplatedata": '{"author":"KingRoboLizard","name":"Function » BBM.SpawnModel","version":1,"code":"H4sIAAAAAAAA/9VY207jMBD9lcjSikWK0LIIpM0b110kYB9AvFBUuc60NTh21p4AFeq/79hNS0hv4VLYfWriy8w5x2cmSR9ZRxlx61hy9chkypLRPYvL34R1Cy3oltseLaI1CFm5mq7CiN8VbmKWcuTjVTT6eHDUPtu7SLZ+bG/HwmS50aDRJY8tlkkNwvIuJqJwaLK25hm0WLJGc/CAlrd8khYTRhlL1y2KbW/b/E9BM3GLIS0Kw+c5v9fRqUlBtdjwmqYkciUFTXa5clBdSwvW4mpuiu2TXvmsHaPSyqanxPd9ohOSzgY2jWnPa9cBLfoRmujgaB4w0+kWTnCEamKHVt4C9q0pev3ZLOiu0ClYRUQmW4nam2j0LB/MkNZFPMq8ulHXmizCPkQ9eQc68me88UHMrodkn0JjshnLNKmeoBOFum1TJq4GjqIM2XAYM6cMsuTbMK7ZNNdtUBWfetPRcOBHwzjI4cnMuSosV2OYzOQoja4MpOCElWGUNgUHVpJvNk1OXuEhxiQ/jbw4/agMJrGecHxvisOBAoHGPuHAB1yEA20xDaMMEiHv0V5tEMbaRD5P1BlEKXR5oXCjAnJrCmRfaqw2lLRsRXV221M7O6o9Sj7ea8bgjjwDT4+mE3bsol8yTcELz0W5JB0QSinq/a+ScGdIZixjs729042gfHn68ZwmKrvtO26Xt9HRovkH44QZOYT8/8zoHtOExCW3hw/SofMJkYquU4RjOPt9UYFouaBi9Omkpfg0RLErLtTGZvMZOcAVU6qf68xA48qdE2XzuTDRT8BjinnmnbhQCqHMyCqr10IUHQjNbfVi1KOMCnwunmoTeaZjKeMF1dGKRKESdR9sDiK1q1TJy80nZiEHjq/kJd9MqoFdasROqdnKXMELar/kuKLDzTj1pIfG7WzfEhY4oYa2okO5ecmh6CKbjrC589/Jf8cXlEZDLy6u0ob95guF/irXRfi9Wc8Wtp0DKfCSqwI+z5vNWs9yjWs22c3JAmmd29In08qtAlb+Y075ZIeEKO/yfHpPURY/rRuI0qNw7XLP64SpfMi8uXiWuG5am9ceVU2r8DIfPt8PpMvnqwUaJQ7eptcLH4MekOKD0/EupJzgO8IJd3gY8KwW77u9tC94Cao1xXPA/fD30EX4oltMuXGvvB7+BfNTCbv3EgAA"}'}}}, id: "minecraft:ender_chest"}`)
                items.push(`{count: 1, components: {"minecraft:custom_name": '{"extra":[{"bold":true,"color":"aqua","italic":false,"obfuscated":false,"strikethrough":false,"text":"Function ","underlined":false},{"bold":false,"color":"dark_aqua","italic":false,"text":"» "},{"clickEvent":{"action":"open_url","value":"http://BBM.PlayAnimation"},"color":"aqua","italic":false,"text":"BBM.PlayAnimation"},{"color":"aqua","italic":false,"text":""}],"text":""}', "minecraft:custom_data": {PublicBukkitValues: {"hypercube:codetemplatedata": '{"author":"KingRoboLizard","name":"Function » BBM.PlayAnimation","version":1,"code":"H4sIAAAAAAAA/9VYbW/bNhD+KwKBojEgBHOGFJiAfchLswaYs2Hxug91IFAUZTOhSI08pTYC//cdZcuhZct2amdpP8l8u7vn4XNH0k8kkZo9WBJ9eSIiJdGsTcL5NyJZqRg2qRniJJwDPJ/Pxl9Vj1tVNUKSUqD1LOx9uryKb8770c+/nJ6GTOeFVlyBjZ4GJBeKM0MziFhpQeexojkfkOg9jvExGDpwTgaEaakN/h6gbfMQ039LHAkHBHBS1f2npJPgTImcgtBqQKZ3OCqASsFwPKPScn86Tngf+u7RvPP7xTlOtEy9Rc++v44QUeV3fWyrYZ07+hKu2CgAHVxetQWmk6y0jAL3HVsw4oHDyOhyOFqPAlulSrmRCGSxFKHtBWNo6GSVXRvAiAe0pjjIjM6rrqF45Cpwe338P8G7m6KMSgVRNxRp5G+jZaV8iC1X1mGZkuk0JFZqINFP07Ah1kLFXHpqddLD7gVCHIJJwZ9lXcjSUFkHSnThZnkdKbfMiKoXFy3E6AXR3TUIyyVnoM1zDDCGTSGAKVciuJ0bCYAOca3S4Az1dMpl4PwEySRIeUZLCcdekCcrQY6EAj+t03lBaKA7OV1Zmch45rxeq+vgrhwCBw+HI3Jtg08iTbkjnbL5lHSCUQrWrEKeww9TlMLcNjk/7x07oXrEhy3VTGTxIzXb69lsUvveWKarzXH6XNKaC2uB4zM1H8fCgnUOAVWflNVO3PzR90I0lGE2OHfCoH3sQtueCJU2eTsiy+GVITW3dq0hP3laLHWXyQl+43CNdm+cIL97fNsNrab4LHMbhpYTbomR20IKuEWZqOH3xMdaGO8ElufxUW0v7HY2UtFeDm50YAvKuF2UhD4eA8FnKkse9LgZOjZ8kmb8rBKyUh2aSzZlHJN6VpReP+UQpH2DdMNsO5PSJVzfBdAKzvCCU/hGbNlLgKkyX6MrvCCayZEjKcwM9lXnfacdVw8PMVFI/oKCOof4OhSIg1LAyuQtGNhP4ahMI8Y7n5IXBmPhv+M5+Upbcr/3lnQ//HD0P1K5d5XZXKp2PPDeoekj0WHVN+tk1fe+k7efg1iqLgWD6gh4O43uxNAOXDfkclagFNImtq0n0nbJuIM41sn9W9+UNhTABhUfFQgQ3F5olbpFZXJWD32i9qL6XwAPq3bQ3BmYxHODW3Fvrba1REWnvVpdCltcK+Cm0HLxWkTH3G3a7OG18QXywpgPUWBdyPg86tWrXhLuRl0tefmLY0YeUtJ7vdX2v4l024X768Feb0yj+rT8Ru2ebETVfufuC/eX3+K+LfAB9rcS4F+z/6FVuxln+yW7WnCwK/Z+vOyQ0z8WWXWq3E3/A2Or9YSxFQAA"}'}}}, id: "minecraft:ender_chest"}`)
            }
            SendModelItems(items);
        }
    }).show();
    const dropdownscript = document.createElement("script")
    dropdownscript.innerHTML = `
                    var checkList = document.getElementById('list1');
                    var selectedAnims = [];
                    var itemlist = document.getElementById("animationlist");
                    for (let animation of Animation.all) {
                        let anim = document.createElement("li");
                        anim.innerHTML = '<label class="listlabel"><input type="checkbox" onclick="togglesel(this)">'+animation.name+'</label>';
                        itemlist.appendChild(anim);
                    }

                    function toggledropdown() {
                        if (checkList.classList.contains('visible'))
                            checkList.classList.remove('visible');
                        else
                            checkList.classList.add('visible');
                    }
                    
                    function togglesel(elem){
                        let animName = elem.parentElement.textContent.trim();
                        if(selectedAnims.includes(animName)){
                            selectedAnims.remove(animName);
                        }
                        else{
                            selectedAnims.push(animName);
                        }
                    }`;

    const dropdown = document.createElement("div")
    dropdown.classList.add("dropdowncontainer")
    dropdown.innerHTML = `
                    <div id="list1" class="dropdown-check-list dialog_bar bar form_bar" title="Selected animations will be exported as items to your inventory.">
                    <label class="name_space_left">Animations to export:</label><div class="half"><span class="anchor" onclick="toggledropdown()">Animations</span>
                    <ul class="items" id="animationlist"></ul>
                    </div>
                    <i class="fa fa-question dialog_form_description" onclick="Blockbench.showQuickMessage('Selected animations will be exported as items to your inventory.', 3600);"></i>
                    </div>`
    let form = exportDialog.object.getElementsByClassName("dialog_content")[0].getElementsByClassName("form")[0];
    form.appendChild(dropdown);
    form.appendChild(dropdownscript);
}

var exportAction;
let style;
Plugin.register("df_exporter", {
    title: "DF Model Exporter",
    author: "KingRoboLizard",
    description: "lets you export models to diamondfire.",
    tags: ["Exporter", "Minecraft: Java Edition"],
    icon: "keyboard_capslock",
    version: "0.3.0",
    variant: "both",
    onload() {
        style = Blockbench.addCSS(`
                    .dropdown-check-list {
                    display: inline-block;
                    }

                    .dropdown-check-list .anchor {
                    position: relative;
                    cursor: pointer;
                    display: inline-block;
                    padding: 5px 30px 5px 10px;
                    width: 100%;
                    background: #21252b;
                    border: 1px solid #181a1f;
                    }

                    .dropdown-check-list .anchor:after {
                    position: absolute;
                    content: "❯";
                    padding: 5px;
                    right: 8px;
                    top: -4%;
                    transform: rotate(90deg);
                    }

                    .dropdown-check-list ul.items {
                    padding: 2px;
                    display: none;
                    margin: 0;
                    background: #21252b;
                    border: 1px solid #181a1f;
                    border-top: none;
                    max-height: 200px;
                    overflow:hidden; overflow-y:scroll;
                    }

                    .dropdown-check-list ul.items li {
                    list-style: none;
                    }

                    .dropdown-check-list.visible .anchor {
                    color: #3e90ff;
                    }
                    .dropdown-check-list.visible .anchor:after {
                    transform: rotate(270deg);
                    }

                    .dropdown-check-list.visible .items {
                    display: block;
                    }
                    
                    .listlabel {
                    display:block; 
                    border-radius: 3px;
                    }

                    .listlabel:hover {
                    background:#474d5d;
                    cursor:pointer;
                    }`);

        exportAction = new Action("df_exporter", {
            name: "Export to DiamondFire",
            category: "file",
            description: "Export model as item",
            icon: "fa-file-export",
            click() {
                showExportDialog();
            }
        });

        MenuBar.addAction(exportAction, "file.export");
    },
    onunload() {
        exportAction.delete();
        // exportDialog.close();
        style.delete();
    }
});

class DisplayCube {
    Cube;
    Matrix = [];
}