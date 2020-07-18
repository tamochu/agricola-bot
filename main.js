const request = require("request");
const {JSDOM} = require("jsdom");
const jquery = require("jquery");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('.data/db.json');
const db = low(adapter);
const express = require("express");
const app = express();

const AI = require("./ai");
const {IMPROVEMENTS, OCCUPATIONS, ACTIONS, SOWABLE, RESOURCES} = require("./constants");

const jar = request.jar();
// AIを参加させる部屋番号（テスト用にデフォルト登録してある）
/*
db.defaults({
  rooms: [
    {"roomId": 3679409}
  ]
}).write();
*/
// faireの関数を呼び出す部分を抜き出す正規関数
const faireRegExp = /^(?<action>.*?),(?<val>.*?),(?<complement>.*?)$/;
const terminerRegExp = /^(?<confirmation>.*?),(?<action>.*?),(?<val>.*?),(?<complement>.*?)$/;
const radioRegExp = /radioValue\('document\.(forms\.)?(?<form>.*?)\.(?<input>.*?)'\)/g;
const checkboxRegExp = /checkboxValue\('document\.(forms\.)?(?<form>.*?)\.(?<input>.*?)'\)/g;
// 定数
// ボタンの文字列
const NOT_EXIST = "This game doesn't exist!";
const GAME_OVER = '- GAME OVER -';
const END_OF_TURN = 'END OF TURN';
const TIME_TO_LUNCH = 'TIME TO LUNCH!';
const CHOOSE_ACTION = 'Choose an action in the first tab on the left !';
const OK = 'OK';
const FENCE = 'FENCE';
const SOW = 'SOW';
const BAKE = 'BAKE';
const END = 'END';
// 家の色
const ROOM_COLOR_WOOD = 'rgb(96, 57, 19)';
const ROOM_COLOR_CLAY = 'rgb(198, 156, 109)';
const ROOM_COLOR_STONE = 'rgb(180, 180, 180)';
const FARM_COLOR = 'rgb(0, 166, 81)';
const FIELD_COLOR = 'rgb(255, 245, 104)';
// AIのアクションが失敗するものを選んだ場合、単純取得系のアクションを替わりに行う
const simpleActions = [
  ACTIONS.WOOD3,
  ACTIONS.CLAY1_1,
  ACTIONS.REED1,
  ACTIONS.FISHING,
  ACTIONS.GRAIN,
  ACTIONS.DAY_LABOURER,
  ACTIONS.WOOD2_1,
  ACTIONS.CLAY1_2,
  ACTIONS.REED_WOOD_STONE,
  ACTIONS.WOOD1,
  ACTIONS.CRAY2,
  ACTIONS.TRAVELLING_PLAYERS,
  ACTIONS.SUPPLY,
  ACTIONS.WOOD4,
  ACTIONS.CRAY3,
  ACTIONS.SHEEP1,
  ACTIONS.STONE1_1,
  ACTIONS.BOAR,
  ACTIONS.VEGETABLE,
  ACTIONS.CATTLE,
  ACTIONS.STONE1_2,
  ACTIONS.WOOD2_2
];
const cookableImprovements = [
  IMPROVEMENTS.FIREPLACE2,
  IMPROVEMENTS.FIREPLACE3,
  IMPROVEMENTS.COOKING_HEARTH4,
  IMPROVEMENTS.COOKING_HEARTH5,
  IMPROVEMENTS.SIMPLE_FIREPLACE
];

const trimQuote = str => str.match(/^'?(?<raw>.*?)'?$/).groups.raw;
/**
 * リクエストのasync関数
 */
const myRequest = async (url, options) => new Promise((resolve, reject) => {
  request(url, options, (err, res, body) => {
    if (err) {
      reject(err);
      return;
    }
    resolve({res, body});
  });
});
/**
 * evalのラッパー
 */
const myEval = (str) => {
  if (!str.includes('\'') && !str.includes('"')  && str.includes('|')) {
    return str;
  }
  try {
    return eval(str);
  } catch (e) {}
  return str;
}

/**
 * ボタンをvalueから取得する
 */
const getBtn = ($doc, btnValue) => $doc.find("input[value='" + btnValue + "']");

/**
 * ボタンがあるか調べる
 */
const findBtn = ($doc, btnValue) => !!getBtn($doc, btnValue)[0];

/**
 * jquery用にダミーのdiv要素で囲む
 */
const dummyDiv = str => `<div>${str}</div>`;

/**
 * ログイン済みか調べる
 */
const loginCheck = async () => {
  return myRequest('http://www.boiteajeux.net/index.php', {
    method: 'GET',
    jar: jar
  }).then(({res, body}) => {
    return body.indexOf('logout') >= 0;
  });
}

/**
 * ログインを実行する
 */
const login = async() => {
  return myRequest('http://www.boiteajeux.net/gestion.php', {
    method: 'POST',
    jar: jar,
    form: {
      p: '',
      pAction: 'login',
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    }
  });
}

/**
 * agrajaxにリクエストを投げる
 */
const agrajax = async (obj) => myRequest(`http://www.boiteajeux.net/jeux/agr/agrajax.php?${Object.keys(obj).map(k => `${k}=${obj[k]}`).join('&')}`, {
  method: 'GET',
  jar: jar
});

const AgrBot = class {
  constructor(roomId) {
    this.id = roomId
  }
  
  myInfo() {
    return this.info.player[this.info.iam];
  }

  /**
   * ゲームに参加する
   */
  async join() {
    return myRequest('http://www.boiteajeux.net/gestion.php', {
      method: 'POST',
      jar: jar,
      form: {
        p: '',
        pAction: 'rejoindre',
        inv: '',
        id: `agr-${this.id}`
      }
    });
  }
  
  /**
   * faire関数を実行する
   */
  async faire(action, val, complement) {
    console.log('faire', action, val, complement);
    const logId = `${this.id}-${this.idCoup}`;
    if(!db.has('logs').value()) {
      db.set('logs', []).write();
    }
    if(!db.get('logs').find({
      id: logId
    }).value()) {
      db.get('logs').push({
        id: logId,
        pAction: action,
        pVal: val,
        pComplement: complement,
        room: this.id,
        at: Date.now()
      }).write();
    }
    
    return myRequest(`http://www.boiteajeux.net/jeux/agr/traitement.php?id=${this.id}`, {
      method: 'POST',
      jar: jar,
      form: {
        pAction: action,
        pVal: val,
        pComplement: complement,
        pIdCoup: this.idCoup,
        pSP: 1
      }
    });
  }

  /**
   * ドラフト選択
   */
  async sendDraft(amNo, sfNo){
    return this.faire('draft', amNo, sfNo);
  }

  /**
   * HTML中にあるfaireコマンドの一覧を取得する
   */
  findCmds(str) {
    let modalCmds = [];
    this.$(str).find('.jqModal').each((i, e) => {
      const $popupDiv = this.$('#' + this.actionDivMap.find(m => m.trigger === this.$(e).attr('id')).div);
      modalCmds = [].concat(modalCmds, this.findCmds($popupDiv.html()));
    });
    const parenRegExp = /\((.*?)\)/
    const faireCmds = str.split('faire(').map(faireInnerStr => {
      let c = faireInnerStr;
      while (true) {
        if (!c.match(parenRegExp)) {
          break;
        }
        c = c.replace(parenRegExp, (m, p1) => `【${p1}】`);
      }
      return c.slice(0, c.indexOf(')')).replace(/【/g, '(').replace(/】/g, ')');
    }).slice(1).map(fs => fs.match(faireRegExp)).map(f => {
      const complementHtmlMatch = f.groups.complement.match(/\$\('(?<complementHtmlSelector>.*?)'\)\.html\(\)/);
      return {
        action: f.groups.action,
        val: f.groups.val,
        complement: !complementHtmlMatch ? f.groups.complement : 
          `${this.$(complementHtmlMatch.groups.complementHtmlSelector).html()}`
      };
    });
    const terminerCmds = str.split('terminer(').map(terminerInnerStr => {
      let c = terminerInnerStr;
      while (true) {
        if (!c.match(parenRegExp)) {
          break;
        }
        c = c.replace(parenRegExp, (m, p1) => `【${p1}】`);
      }
      return c.slice(0, c.indexOf(')')).replace(/【/g, '(').replace(/】/g, ')');
    }).slice(1).map(fs => fs.match(terminerRegExp)).map(f => {
      const complementHtmlMatch = f.groups.complement.match(/\$\('(?<complementHtmlSelector>.*?)'\)\.html\(\)/);
      return {
        action: f.groups.action,
        val: f.groups.val,
        complement: !complementHtmlMatch ? f.groups.complement : 
          `${this.$(complementHtmlMatch.groups.complementHtmlSelector).html()}`
      };
    });
    const checkSPCmds = str.split('checkSP(').map(checkSPInnerStr => {
      let c = checkSPInnerStr;
      while (true) {
        if (!c.match(parenRegExp)) {
          break;
        }
        c = c.replace(parenRegExp, (m, p1) => `【${p1}】`);
      }
      return c.slice(0, c.indexOf(')')).replace(/【/g, '(').replace(/】/g, ')');
    }).slice(1).map(fs => fs.match(terminerRegExp)).map(f => {
      const complementHtmlMatch = f.groups.complement.match(/\$\('(?<complementHtmlSelector>.*?)'\)\.html\(\)/);
      return {
        action: f.groups.action,
        val: f.groups.val,
        complement: !complementHtmlMatch ? f.groups.complement : 
          `${this.$(complementHtmlMatch.groups.complementHtmlSelector).html()}`
      };
    });
    return this.expand([...modalCmds, ...faireCmds, ...terminerCmds, ...checkSPCmds]);
  }
  
  /**
   * 選択肢を展開する
   */
  expand(cmds) {
    return this.checkboxExpand(this.radioExpand(cmds)).map(c => {
      return ({
        action: myEval(c.action),
        val: myEval(c.val),
        complement: myEval(c.complement)
      })
    });
  }
  
  /**
   * radioValueを展開する
   */
  radioExpand(cmds) {
    return cmds.map(cmd => {
      const replaces = [...cmd.action.matchAll(radioRegExp), ...cmd.val.matchAll(radioRegExp), ...cmd.complement.matchAll(radioRegExp)].map(m => {
        const values = [];
        this.$(`form[name='${m.groups.form}'] input[name='${m.groups.input}']`).each((i, e) => {
          values.push(this.$(e).val());
        });
        return {
          key: m[0],
          values
        }
      });
      return replaces.reduce(
        (replCmds, r) => replCmds.map(
          c =>  r.values.map(
            val => ({
                action: c.action.split(r.key).join(`'${val}'`),
                val: c.val.split(r.key).join(`'${val}'`),
                complement: c.complement.split(r.key).join(`'${val}'`)
              })
            )).flat()
        , [cmd]);
    }).flat();
  }
  
  /**
   * checkboxValueを展開する
   */
  checkboxExpand(cmds) {
    return cmds.map(cmd => {
      const replaces = [...cmd.action.matchAll(checkboxRegExp), ...cmd.val.matchAll(checkboxRegExp), ...cmd.complement.matchAll(checkboxRegExp)].map(m => {
        const flgs = [];
        this.$(`form[name='${m.groups.form}'] input[name='${m.groups.input}']`).each((i, e) => {
          flgs.push(this.$(e).val());
        });
        const values = flgs.reduce((vs, flg) => {
          const newVs = [];
          vs.forEach(v => {
            newVs.push(v);
            newVs.push(v + flg);
          });
          return newVs;
        }, ['']);
        return {
          key: m[0],
          values
        }
      });
      return replaces.reduce(
        (replCmds, r) => replCmds.map(
          c =>  r.values.map(
            val => ({
                action: c.action.split(r.key).join(`'${val}'`),
                val: c.val.split(r.key).join(`'${val}'`),
                complement: c.complement.split(r.key).join(`'${val}'`)
              })
            )).flat()
        , [cmd]);
    }).flat();
  }

  /**
   * HTML中のボタンを押下する
   */
  async faireBtn($doc, btnValue) {
    const btnCmd = this.findCmds(dummyDiv(getBtn($doc, btnValue).attr("onclick")))[0];
    return this.faire(btnCmd.action, btnCmd.val, btnCmd.complement);
  }

  /**
   * 選択肢のうちから選ぶ
   */
  async chooseFaire(selections, divId) {
    if (selections.length === 0) {
      throw new Error('illegal action');
    }
    if (selections.length === 1) {
      return this.faire(selections[0].action, selections[0].val, selections[0].complement);
    }
    const selectionsWOConfirmfinaction = selections.filter(s => s.action !== 'confirmfinaction');
    if (selectionsWOConfirmfinaction.length === 0) {
      return this.faire(selections[0].action, selections[0].val, selections[0].complement);
    }
    if (selectionsWOConfirmfinaction.length === 1) {
      return this.faire(selectionsWOConfirmfinaction[0].action, selectionsWOConfirmfinaction[0].val, selectionsWOConfirmfinaction[0].complement);
    }
    
    const chooseIdx = this.ai.choose(selectionsWOConfirmfinaction, divId);
    return this.faire(selectionsWOConfirmfinaction[chooseIdx].action, selectionsWOConfirmfinaction[chooseIdx].val, selectionsWOConfirmfinaction[chooseIdx].complement);
  }
  
  /**
   * 柵を立てるアクション
   */
  async fenceAction($popupDiv) {
    const $miniDivs = $popupDiv.find('.clClotureMiniCase');
    const fences = [];
    $miniDivs.each((i, e) => {
      const x = Math.floor(i / 5);
      const y = i % 5;
      const $baseDiv = this.$(e).find("div[style='height:40px']");
      if ($baseDiv.prevAll('a:has(div.clClotureHClick)')[0]) {
        fences.push({
          x,
          y,
          z: 0,
          s: 0
        });
      } else if ($baseDiv.prevAll('div.clClotureHEnCours')[0]) {
        fences.push({
          x,
          y,
          z: 0,
          s: 1
        });
      } else {
        fences.push({
          x,
          y,
          z: 0,
          s: -1
        });
      }
      const $sideA = $baseDiv.prevAll('a:has(div.clClotureVClick)').find('div.clClotureVClick');
      const $sideDiv = $baseDiv.prevAll('div.clClotureVEnCours');
      let sLeft = -1;
      let sRight = -1;
      $sideA.each((si, se) => {
        if (this.$(se).css('float') === 'left') {
          sLeft = 0;
        } else if (this.$(se).css('float') === 'right') {
          sRight = 0;
        }
      });
      $sideDiv.each((si, se) => {
        if (this.$(se).css('float') === 'left') {
          sLeft = 1;
        } else if (this.$(se).css('float') === 'right') {
          sRight = 1;
        }
      });
      fences.push({
        x,
        y,
        z: 3,
        s: sLeft
      });
      if (y === 4) {
        fences.push({
          x,
          y,
          z: 1,
          s: sRight
        });
      }
      if (x === 2) {
        if ($baseDiv.nextAll('a:has(div.clClotureHClick)')[0]) {
          fences.push({
            x,
            y,
            z: 2,
            s: 0
          });
        } else if ($baseDiv.nextAll('div.clClotureHEnCours')[0]) {
          fences.push({
            x,
            y,
            z: 2,
            s: 1
          });
        } else {
          fences.push({
            x,
            y,
            z: 2,
            s: -1
          });
        }
      }
    });
    const gFences = this.ai.fences(fences);
    const restFences = gFences.filter(gf => fences.some(f => f.x === gf.x && f.y === gf.y && f.z ===gf.z && f.s === 0));
    if (restFences.length > 0) {
      const paturageParams = $popupDiv.html().match(/'agrajax\.php\?(?<params>.*?)'/).groups.params.split('&').map(p => {
        const sp = p.split('=');
        return {
          key: sp[0],
          value: sp[1]
        };
      });
      return agrajax({
        id: this.id,
        aid: paturageParams.find(p => p.key === 'aid').value,
        a: 'paturage',
        c: restFences.map(f => `${f.x};${f.y};${f.z}`).join('|')
      }).then(aRet => {
        const $ajaxDiv = this.$(`<div>${aRet.body}</div>`);
        if (findBtn($ajaxDiv, FENCE)) {
          return this.faireBtn($ajaxDiv, FENCE);
        }
      });
    }
  }

  /**
   * 種をまくアクション
   */
  async sowAction($popupDiv) {
    const sems = {};
    $popupDiv.find('.rbSem').each((i, e) => {
      if (!sems[this.$(e).attr('name')]) {
        sems[this.$(e).attr('name')] = {};
      }
      if (this.$(e).hasClass('rbC')) {
        sems[this.$(e).attr('name')][SOWABLE.GRAIN] = this.$(e).val();
      }
      if (this.$(e).hasClass('rbL')) {
        sems[this.$(e).attr('name')][SOWABLE.VEGETABLE] = this.$(e).val();
      }
    });
    if ($popupDiv.find('#c078')[0]) {
      $popupDiv.find('#c078 option').each((i, e) => {
        if (this.$(e).val() > 0) {
          sems['c078'][`${SOWABLE.WOOD}_${this.$(e).val()}`] = `c078${this.$(e).val()}`;
        }
      });
    }
    // TODO 木もここで処理の気がする

    const gSow = this.ai.sow(sems);
    if (Object.keys(gSow).filter(k => gSow[k] === SOWABLE.GRAIN).length > this.myInfo().grain) {
      throw new Error('too many grains to sow');
    }

    if (Object.keys(gSow).filter(k => gSow[k] === SOWABLE.VEGETABLE).length > this.myInfo().vegetable) {
      throw new Error('too many vegetables to sow');
    }

    if (Object.keys(gSow).filter(k => gSow[k] === SOWABLE.WOOD).length > this.myInfo().wood) {
      throw new Error('too many woods to sow');
    }

    if (Object.keys(gSow).filter(k => gSow[k]).length <= 0) {
      throw new Error('at least 1 sow');
    }

    const tabSemer = new Array();
    Object.keys(gSow).forEach(name => {
      const val = sems[name][gSow[name]];
      if (val) {
        tabSemer.push(val);
      }
    });
    const cmds = this.findCmds(dummyDiv($popupDiv.prev().html())).filter(c => c.complement === 'JSON.stringify(tabSemer)');

    return this.faire(cmds[0].action, cmds[0].val, JSON.stringify(tabSemer));
  }

  /**
   * パンを焼くアクション
   */
  async bakeAction($popupDiv) {
    const cuires = [];
    $popupDiv.find('.cuireQte').each((i, e) => {
      const values = [];
      this.$(e).find('option').each((oi, oe) => {
        values.push(parseInt(this.$(oe).val(), 10));
      });
      cuires.push({
        name: this.$(e).parent().prev().text(),
        values
      });
    });
    const gCuire = this.ai.cuire(cuires);
    let sumGrain = 0;
    for (let i = 0; i < gCuire.length; i++) {
      if (!cuires[i].values.includes(gCuire[i])) {
        throw new Error('over capacity');
      }
      sumGrain += gCuire[i];
    }
    if (sumGrain <= 0) {
      throw new Error('at least 1 bake');
    }
    if (sumGrain > this.myInfo().grain) {
      throw new Error('over grain');
    }
    const cmds = this.findCmds(dummyDiv($popupDiv.prev().html()));

    return this.faire(cmds[0].action, cmds[0].val, gCuire.join(','));
  }
  
  /**
   * 家畜を牧場に入れるアクション
   */
  async validerAction($popupDiv) {
    const mRef = parseInt($popupDiv.find('#dvMref').html(), 10);
    const sRef = parseInt($popupDiv.find('#dvSref').html(), 10);
    const bfRef = parseInt($popupDiv.find('#dvBFref').html(), 10);
    const capacity = {
      se: {},
      am: {}
    };
    $popupDiv.find('.clSeM').each((i, e) => {
      const numero = this.$(e).attr('id').split('seM')[1];
      if (capacity.se[numero] === undefined) {
        capacity.se[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.se[numero].m) {
          capacity.se[numero].m = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    $popupDiv.find('.clSeS').each((i, e) => {
      const numero = this.$(e).attr('id').split('seS')[1];
      if (capacity.se[numero] === undefined) {
        capacity.se[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.se[numero].s) {
          capacity.se[numero].s = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    $popupDiv.find('.clSeBF').each((i, e) => {
      const numero = this.$(e).attr('id').split('seBF')[1];
      if (capacity.se[numero] === undefined) {
        capacity.se[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.se[numero].bf) {
          capacity.se[numero].bf = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    $popupDiv.find('.clAmM').each((i, e) => {
      const numero = this.$(e).attr('id').split('amM')[1];
      if (capacity.am[numero] === undefined) {
        capacity.am[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.am[numero].m) {
          capacity.am[numero].m = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    $popupDiv.find('.clAmS').each((i, e) => {
      const numero = this.$(e).attr('id').split('amS')[1];
      if (capacity.am[numero] === undefined) {
        capacity.am[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.am[numero].s) {
          capacity.am[numero].s = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    $popupDiv.find('.clAmBF').each((i, e) => {
      const numero = this.$(e).attr('id').split('amBF')[1];
      if (capacity.am[numero] === undefined) {
        capacity.am[numero] = {
          m: 0,
          s: 0,
          bf: 0
        };
      }
      this.$(e).find('option').each((oi, oe) => {
        if (this.$(oe).val() > capacity.am[numero].bf) {
          capacity.am[numero].bf = parseInt(this.$(oe).val(), 10);
        }
      });
    });
    const gValider = this.ai.valider(mRef, sRef, bfRef, capacity);
    const mSum = Object.keys(gValider.se).reduce((s, n) => s + gValider.se[n].m, 0)
      + Object.keys(gValider.am).reduce((s, n) => s + gValider.am[n].m, 0);
    const sSum = Object.keys(gValider.se).reduce((s, n) => s + gValider.se[n].s, 0)
      + Object.keys(gValider.am).reduce((s, n) => s + gValider.am[n].s, 0);
    const bfSum = Object.keys(gValider.se).reduce((s, n) => s + gValider.se[n].bf, 0)
      + Object.keys(gValider.am).reduce((s, n) => s + gValider.am[n].bf, 0);
    if (mRef < mSum || sRef < sSum || bfRef < bfSum) {
      throw new Error('you do not have enough aminals');
    }
    console.log('valider', capacity, gValider);
    const cuisson = Object.keys(gValider.am)
      .filter(k => cookableImprovements.includes(k))
      .map(k => `${k};${gValider.am[k].m};${gValider.am[k].s};${gValider.am[k].bf}`).join('@');
    const amenagement = Object.keys(gValider.am)
      .filter(k => !cookableImprovements.includes(k))
      .map(k => `${k};${gValider.am[k].m};${gValider.am[k].s};${gValider.am[k].bf}`).join('|');
    const location = Object.keys(gValider.se).map(k => `${gValider.se[k].m};${gValider.se[k].s};${gValider.se[k].bf}`).join('|');
    const param = `${mRef - mSum};${sRef - sSum};${bfRef - bfSum}|${cuisson}|${amenagement}|${location}`;
    const cmds = this.findCmds($popupDiv.html());
    return this.faire(cmds[0].action, cmds[0].val, param);
  }

  /**
   * 食事の時間です
   */
  async lunchAction($popupDiv, danger) {
    const cmds = this.findCmds($popupDiv.html());
    if (cmds.length <= 0) {
      throw new Error('illegal action');
    }
    // TODO 変換
    if (danger) {
      console.log('danger');
    }
    console.log('lunch', cmds);
    const alimentationIdx = this.ai.lunch(cmds, danger);
    if (alimentationIdx >= 0) {
      return this.faire(cmds[alimentationIdx].action, cmds[alimentationIdx].val, cmds[alimentationIdx].complement);
    }
    return this.chooseFaire(cmds, $popupDiv.attr('id'));
  }
  
  /**
   * 選択系のポップアップ
   */
  async choisirAction($popupDiv) {
    const cmds = this.findCmds($popupDiv.html());
    if (cmds.length <= 0) {
      throw new Error('illegal action');
    }
    
    if (cmds[0].action === 'choisirAction') {
      const selections = [];
      const complementRadioMatches = [...cmds[0].complement.matchAll(radioRegExp)];
      if (complementRadioMatches.length) {
        const iNames = [...cmds[0].complement.matchAll(radioRegExp)][0].groups;
        $popupDiv.find(`form[name='${iNames.form}'] input[name='${iNames.input}']`).each((i, e) => {
          selections.push({
            action: cmds[0].action,
            val: cmds[0].val,
            complement: this.$(e).val()
          });
        });
      } else {
        if (cmds[0].action === 'echangeFour') {
          this.ai.logger({
            choisir: 'echangeFour',
            html: $popupDiv.html()
          });
        }
        return this.chooseFaire(cmds, $popupDiv.attr('id'));
      }

      return this.chooseFaire(selections, $popupDiv.attr('id'));
    }
    throw new Error('non choisir action');
  }

  /**
   * アクションを実行する
   */
  async sendAction(actionNo) {
    const $actionDiv = this.$("div.clCaseAction[rel='aideAction.php?a=" + actionNo + "']");
    if ($actionDiv.find(".clActionCliquable")[0]) {
      const actionId = $actionDiv.find('a.jqModal').attr("id");
      const $popupDiv = this.$('#' + this.actionDivMap.find(m => m.trigger === actionId).div);
      switch (actionNo) {
        case ACTIONS.FENCES:
          return this.fenceAction($popupDiv);
        case ACTIONS.HOUSE_STABLE:
        case ACTIONS.FAMILY_MINOR_IMPROVEMENT:
        case ACTIONS.SOW_BAKING_BREAD:
        case ACTIONS.RENOVATION_IMPROVEMENT:
        case ACTIONS.PLOUGHING_SOW:
        case ACTIONS.RENOVATION_FENCES:
          return this.choisirAction($popupDiv);
        default:
          break;
      }
      return this.choosePopupAction($popupDiv);
    }
    return
  }

  /**
   * ポップアップ表示されているものからアクションを選ぶ
   */
  async choosePopupAction($popupDiv) {
    if (findBtn($popupDiv, OK)) {
      return this.faireBtn($popupDiv, OK);
    }
    const cmds = this.findCmds($popupDiv.html());
    console.log('choose cmds', cmds);
    if (cmds.length <= 0) {
      console.log('no cmd', $popupDiv.html());
      if (findBtn($popupDiv, END)) {
        return this.faireBtn($popupDiv, END);
      }
      throw new Error('illegal action');
    }
    return this.chooseFaire(cmds, $popupDiv.attr('id'));
  }
  
  /**
   * ターン終了（確定）
   */
  async endOfTurn() {
    return this.faireBtn(this.$("body"), END_OF_TURN);
  }
  
  /**
   * 盤面情報を取得する
   */
  async getInfo() {
    const info = {
      player: {},
      resource: {},
      hand: {
        am: [],
        sf: []
      }
    };
    const roundMatch = this.$("#dvEnteteInfo").text().match(/Round\s#(?<round>\d+)/);
    if (roundMatch) {
      info.round = parseInt(roundMatch.groups.round, 10);
    }
    const $dvPanneauMain = this.$("#dvPanneauMain");
    $dvPanneauMain.find("table:eq(0) .clCarteMf").each((i, e) => {
      info.hand.am.push(this.$(e).attr('rel').split('aideCarte.php?c=')[1]);
    });
    $dvPanneauMain.find("table:eq(1) .clCarteMf").each((i, e) => {
      info.hand.sf.push(this.$(e).attr('rel').split('aideCarte.php?c=')[1]);
    });
    const $actionDiv = this.$("div.clCaseAction:has(a.jqModal)");
    $actionDiv.each((i, e) => {
      const a = this.$(e).attr("rel").split("aideAction.php?a=")[1];
      const $actionResourceDiv = this.$(`div.clCaseAction[rel='aideAction.php?a=${a}']`).find('.clRessource');
      info.resource[a] = $actionResourceDiv[0] ? parseInt($actionResourceDiv.text(), 10) : 1;
    });
    const $infos = this.$('.clInfosJ');
    $infos.each((i, e) => {
      const player = {};
      player.name = this.$(e).find('span.clLoginJ a span').text();
      if (player.name === process.env.USERNAME) {
        info.iam = i;
      }
      if(this.$(e).find("img[src='img/1stJ.gif']")[0]) {
        if (this.$(e).text().includes(`()${player.name}`)) {
          info.nextFirst = i;
          if (this.$(e).find("img[src='img/1stJ.gif']").length >= 2) {
            info.first = i;
          }
        } else {
          info.first = i;
        }
      }
      player.point = parseInt(this.$(e).html().match(/\((?<point>-?\d*)\spts\)/).groups.point, 10);
      const $familySpan = this.$(e).children('span:eq(1)');
      player.family = parseInt($familySpan.html().match(/\/\s(?<family>\d+)/).groups.family, 10);
      player.growableFamily = 5 - player.family;
      player.restFamily = $familySpan.find('img').length;
      player.fence = parseInt(this.$(e).find("td:has(img[src^='img/barriere16J'])").next('td').text().match(/x\s(?<fence>\d+)/).groups.fence, 10);
      player.stable = parseInt(this.$(e).find("td:has(img[src^='img/etable16J'])").next('td').text().match(/x\s(?<stable>\d+)/).groups.stable, 10);
      player.wood = parseInt(this.$(e).find("td:has(img[src='img/pionBois16.png'])").next('td').text().match(/x\s(?<wood>\d+)/).groups.wood, 10);
      player.clay = parseInt(this.$(e).find("td:has(img[src='img/pionArgile16.png'])").next('td').text().match(/x\s(?<clay>\d+)/).groups.clay, 10);
      player.reed = parseInt(this.$(e).find("td:has(img[src='img/pionRoseau16.png'])").next('td').text().match(/x\s(?<reed>\d+)/).groups.reed, 10);
      player.stone = parseInt(this.$(e).find("td:has(img[src='img/pionPierre16.png'])").next('td').text().match(/x\s(?<stone>\d+)/).groups.stone, 10);
      player.food = parseInt(this.$(e).find("td:has(img[src='img/pionPN16.png'])").next('td').text().match(/x\s(?<food>\d+)/).groups.food, 10);
      player.grain = parseInt(this.$(e).find("td:has(img[src='img/pionCereale16.png'])").next('td').text().match(/x\s(?<grain>\d+)/).groups.grain, 10);
      player.vegetable = parseInt(this.$(e).find("td:has(img[src='img/pionLegume16.png'])").next('td').text().match(/x\s(?<vegetable>\d+)/).groups.vegetable, 10);
      player.sheep = parseInt(this.$(e).find("td:has(img[src='img/pionMouton16.png'])").next('td').text().match(/x\s(?<sheep>\d+)/).groups.sheep, 10);
      player.boar = parseInt(this.$(e).find("td:has(img[src='img/pionSanglier16.png'])").next('td').text().match(/x\s(?<boar>\d+)/).groups.boar, 10);
      player.cattle = parseInt(this.$(e).find("td:has(img[src='img/pionBoeuf16.png'])").next('td').text().match(/x\s(?<cattle>\d+)/).groups.cattle, 10);
      player.rooms = 0;
      player.roomLevel = 1;
      player.farms = 0;
      player.fields = 0;
      this.$(e).find('.clCase18').each((ci, ce) => {
        if (ROOM_COLOR_WOOD === this.$(ce).css('background-color')) {
          player.rooms++;
        } else if (ROOM_COLOR_CLAY === this.$(ce).css('background-color')) {
          player.rooms++;
          player.roomLevel = 2;
        } else if (ROOM_COLOR_STONE === this.$(ce).css('background-color')) {
          player.rooms++;
          player.roomLevel = 3;
        } else if (FARM_COLOR === this.$(ce).css('background-color')) {
          player.farms++;
        } else if (FIELD_COLOR === this.$(ce).css('background-color')) {
          player.fields++;
        }
      });

      info.player[i] = player;
    });

    await Promise.all(Object.keys(info.player).map(async j => {
      info.player[j].fieldDetail = {
        blank: 0,
        grain: [],
        vegetable: [],
        wood: []
      };
      const $exploitation = this.$((await agrajax({
        id: this.id,
        j,
        a: 'exploitation'
      })).body);
      $exploitation.find('.centreCase').each((i, e) => {
        if (this.$(e).css('background-image') === 'url(img/champ.gif)') {
          if (this.$(e).find("img[src='img/pionCereale24.png']")[0]) {
            const $resource = this.$(e).find('div.clRessource');
            if ($resource[0]) {
              info.player[j].fieldDetail.grain.push(parseInt($resource.text(), 10));
            } else {
              info.player[j].fieldDetail.grain.push(1);
            }
          } else if (this.$(e).find("img[src='img/pionLegume24.png']")[0]) {
            const $resource = this.$(e).find('div.clRessource');
            if ($resource[0]) {
              info.player[j].fieldDetail.vegetable.push(parseInt($resource.text(), 10));
            } else {
              info.player[j].fieldDetail.vegetable.push(1);
            }
          } else if (this.$(e).find("img[src='img/hoge.png']")[0]) { // TODO 木
            const $resource = this.$(e).find('div.clRessource');
            if ($resource[0]) {
              info.player[j].fieldDetail.wood.push(parseInt($resource.text(), 10));
            } else {
              info.player[j].fieldDetail.wood.push(1);
            }
          } else {
            info.player[j].fieldDetail.blank++;
          }
        }
      });
      info.player[j][RESOURCES.BLANK_FIELD] = info.player[j].fieldDetail.blank;
      info.player[j][RESOURCES.GRAIN_FIELD] = info.player[j].fieldDetail.grain;
      info.player[j][RESOURCES.VEGETABLE_FIELD] = info.player[j].fieldDetail.vegetable;
      info.player[j].cards = [];
      info.player[j][RESOURCES.AM] = [];
      info.player[j][RESOURCES.SF] = [];
      const $cartes = this.$((await agrajax({
        id: this.id,
        j,
        a: 'cartes'
      })).body);
      $cartes.find('.clCarteMf').each((i, e) => {
        const card = this.$(e).attr('rel').split('aideCarte.php?c=')[1];
        info.player[j].cards.push(card);
        if (Object.values(IMPROVEMENTS).includes(card)) {
          info.player[j][RESOURCES.AM].push(card);
        }
        if (Object.values(OCCUPATIONS).includes(card)) {
          info.player[j][RESOURCES.SF].push(card);
        }
      });
      info.player[j][RESOURCES.AM_LENGTH] = info.player[j][RESOURCES.AM].length;
      info.player[j][RESOURCES.SF_LENGTH] = info.player[j][RESOURCES.SF].length;
      
      // TODO あとで作る
      const $attente = this.$((await agrajax({
        id: this.id,
        j,
        a: 'attente'
      })).body);
      // console.log($attente.html());
      return;
    }));

    if (info.nextFirst === undefined) {
      info.nextFirst = info.first;
    }

    return info;
  }
  
  /**
   * 自分の手番なら手を打つ
   */
  async partie() {
    return myRequest(`http://www.boiteajeux.net/jeux/agr/partie.php?id=${this.id}&t={Date.now()}`, {
      method: 'GET',
      jar: jar
    }).then(async ({res, body}) => {
      if (body.indexOf(NOT_EXIST) >= 0) {
        console.log("not exist");
        return this.join();
      }
      if (body.indexOf(GAME_OVER) >= 0) {
        console.log("game over");
        db.get('rooms').remove({
          roomId: this.id
        }).write();
        return;
      }
      const dom = new JSDOM(body);
      this.$ = jquery(dom.window);
      this.idCoup = this.$("input[name=pIdCoup]").val();
      
      const jqRegExp = /\$\('#(?<div>.*)'\)\.jqm\(\{trigger: '#(?<trigger>.*)',modal:true/g;
      this.actionDivMap = [...body.matchAll(jqRegExp)].map(m => m.groups);

      this.info = await this.getInfo();
      const logger = obj => {
        if(!db.has('logs').value()) {
          db.set('logs', []).write();
        }
        obj.id = 'aiLog_' + Math.floor(Math.random()*10000000);
        obj.room = this.id;
        obj.at = Date.now();
        
        db.get('logs').push(obj).write();
      }
      this.ai = new AI(this.info, logger);

      // ドラフト
      const $draftForm = this.$("form[name=fmDraft]");
      if ($draftForm[0]) {
        console.log("draft");
        const $amDraft = $draftForm.find("input[name=AMdraft]");
        const amDraftNos = [];
        $amDraft.each((i, e) => {
          amDraftNos.push(this.$(e).val());
        });

        const $sfDraft = $draftForm.find("input[name=SFdraft]");
        const sfDraftNos = [];
        $sfDraft.each((i, e) => {
          sfDraftNos.push(this.$(e).val());
        });

        const amPickedNos = [];
        const $amPickedDiv = $draftForm.children("div:eq(3)");
        $amPickedDiv.children("div").each((i, e) => {
          amPickedNos.push(this.$(e).attr("rel").split("aideCarte.php?c=")[1]);
        });
        const sfPickedNos = [];
        const $sfPickedDiv = $draftForm.children("div:eq(4)");
        $sfPickedDiv.children("div").each((i, e) => {
          sfPickedNos.push(this.$(e).attr("rel").split("aideCarte.php?c=")[1]);
        });

        if (amDraftNos.length > 0 && sfDraftNos.length > 0) {
          const draftNo = this.ai.draft(amDraftNos, sfDraftNos, amPickedNos, sfPickedNos);
          return this.sendDraft(amDraftNos[draftNo.am], sfDraftNos[draftNo.sf]);
        }
      }

      // アクション
      const jqmShowRegExp = /\$\('#(?<div>.*)'\)\.jqm\(\{.*?modal:true.*?\}\)(?<show>\.jqmShow\(\))/g;
      const jqmShowDiv = [...body.matchAll(jqmShowRegExp)].map(m => m.groups);
      if (jqmShowDiv.length > 0) {
        const $showDiv = this.$('#' + jqmShowDiv[0].div);
        if (findBtn($showDiv, SOW)) {
          return this.sowAction($showDiv);
        }
        if (findBtn($showDiv, BAKE)) {
          return this.bakeAction($showDiv);
        }
        if (findBtn($showDiv, TIME_TO_LUNCH)) {
          return this.lunchAction($showDiv, getBtn($showDiv, TIME_TO_LUNCH).hasClass('btn-danger'));
        }
        const okBtn = getBtn($showDiv, OK);
        if (okBtn[0]) {
          if (okBtn.attr('onclick') === 'valider()') {
            return this.validerAction($showDiv);
          }
          console.log(okBtn.attr('onclick'));
        }
        return this.choosePopupAction($showDiv);
      }
      if (body.indexOf(CHOOSE_ACTION) >= 0) {
        console.log("action");
        const actionNos = [];
        const $actionDiv = this.$("div.clCaseAction:has(a.jqModal)");
        $actionDiv.each((i, e) => {
          actionNos.push(this.$(e).attr("rel").split("aideAction.php?a=")[1]);
        });

        const actionNo = this.ai.action(actionNos);

        return this.sendAction(actionNos[actionNo])
          .catch(e => {
            console.log(e);
            const simpleActionNos = actionNos.filter(n => simpleActions.includes(n));
            if (simpleActionNos.length > 0) {
              return this.sendAction(simpleActionNos[0]);
            }
            throw new Error('no action can use');
          });
      }

      // END OF TURN
      if (body.indexOf(END_OF_TURN) >= 0) {
        console.log("end of turn");
        return this.endOfTurn();
      }

      return {res, body}
    });
  }
};

app.get("/", async (req, res) => {
  const rooms = db.get('rooms').value();
  const roomHtml = rooms ? rooms.map(r => r.roomId).join(',') : '';
  const logs = db.get('logs').value();
  const logHtml = logs ? logs.map(l => l.room).filter((elm, idx, self) => self.indexOf(elm) === idx).map(r => `<a href='/showLogs/${r}'>${r}</a>`).join('<br>\n') : '';
  const addHtml = '<input type="text" id="roomId"></input><button onclick="location.href=\'/add/\'+document.getElementById(\'roomId\').value;">ADD</button>';
  res.send(`${addHtml}<br>\nactive rooms:${roomHtml}<br>\nlogs:<br>\n${logHtml}`);
});

app.get("/showAllLogs/", async (req, res) => {
  const logs = db.get('logs').value();
  const logHtml = logs ? logs.map(l => JSON.stringify(l)).join('<br>\n') : '';
  
  res.send(`<a href='/'>back</a><br>\n${logHtml}`);
});

app.get("/showLogs/:roomId", async (req, res) => {
  const logs = db.get('logs').value();
  const logHtml = logs ? logs.filter(l => l.room === req.params.roomId).map(l => JSON.stringify(l)).join('<br>\n') : '';
  
  res.send(`<a href='/'>back</a><br>\n${logHtml}`);
});

app.get("/exec/", async (req, res) => {
  // ログイン済みが調べる
  if (!await loginCheck()) {
    // 未ログインならログインを実行する 
    await login();
  }
  // 手を打つ関数を実行する。
  return Promise.all(db.get('rooms').value().map(room => {
    const bot = new AgrBot(room.roomId);
    return bot.partie().catch(console.error);
  })).then(() => {
    res.send('AI is active\n');
  });
});

app.get("/add/:roomId", (req, res) => {
  // 「/add/1234」等とアクセスしたらその番号をAIを参加させる部屋番号のリストに追加する。
  const roomId = req.params.roomId;
  if(!db.has('rooms').value()) {
    db.set('rooms', []).write();
  }
  if(!db.get('rooms').find({
    roomId
  }).value()) {
    db.get('rooms').push({
      roomId
    }).write();
  }
  res.send('<a href=\'/\'>back</a><br>\nroom add success.\n');
});

app.get("/clear/", (req, res) => {
  db.get('rooms').remove().write();
  
  res.send('<a href=\'/\'>back</a><br>\nDB room clear success.\n');
});

app.get("/clearLog/", (req, res) => {
  db.get('logs').remove().write();
  
  res.send('<a href=\'/\'>back</a><br>\nDB log clear success.\n');
});

const listener = app.listen(process.env.PORT, () => {});