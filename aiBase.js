const { IMPROVEMENTS, ACTIONS, SOWABLE } = require('./constants');

/**
 * AIの基底クラス
 */
const AIBase = class {
  /**
   * コンストラクタ
   * 基本的にオーバーライドしない
   * 初期化処理に追加したい場合はinitをオーバーライドする
   */
  constructor(info, logger) {
    // 盤面情報
    this.info = info;
    this.logger = logger;
    this.init();
  }
  
  /**
   * 自分の情報を取得するユーティル関数
   * 基本的にオーバーライドしない
   * 似たのがほしいなら自分で作る
   */
  myInfo() {
    return Object.assign({}, this.info.player[this.info.iam], {hand: this.info.hand});
  }
  
  /**
   * 屠殺できるか判定するユーティル関数
   * 基本的にオーバーライドしない
   * 似たのがほしいなら自分で作る
   */
  canCookAnimal() {
    return [IMPROVEMENTS.FIREPLACE2, IMPROVEMENTS.FIREPLACE3, IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5, IMPROVEMENTS.SIMPLE_FIREPLACE].some(i => this.myInfo().cards.includes(i));
  }
  
  /**
   * 配列のうち優先度の高いものから取れたらインデックスを返す関数
   * 基本的にオーバーライドしない
   * 似たのがほしいなら自分で作る
   * 
   * @param arr 選択肢の配列
   * @param prior 優先する選択の配列
   *
   * @returns number インデックス
   */
  selectByPrior(arr, prior) {
    const i = prior.reduce((idx, p) => {
      if (idx >= 0) {
        return idx;
      }
      let f = arr.indexOf(p);
      if (f >= 0) {
        return f;
      }
      return -1;
    }, -1);

    if (i >= 0) {
      return i;
    }
    this.logger({
      choise: 'no match'
    });
    return 0;
  }
  
  /**
   * 初期化関数
   * 他の初期化処理が必要なはここをオーバーライドする
   */
  init() {}
  /**
   * 選択可能なドラフトカードのうち何番目のカードを手札にするか
   * デフォルトでは優先度に従って取るだけなので
   * ピックしたものを参照したい場合はオーバーライドする
   *
   * @param amDraft ドラフトで取れる小進歩の配列
   * @param sfDraft ドラフトで取れる職業の配列
   * @param amPicked ドラフトで取った小進歩の配列
   * @param sfPicked ドラフトで取った職業の配列
   *
   * @returns { am: number 小進歩の何番目をとるか, sf: number 職業の何番目をとるか }
   */
  draft(amDraft, sfDraft, amPicked, sfPicked) {
    const prior = this.createDraftPrior(amPicked, sfPicked);
    const am = this.selectByPrior(amDraft, prior.am);
    const sf = this.selectByPrior(sfDraft, prior.sf);
    return {
      am,
      sf
    }
  }
  /**
   * 利用可能なアクションのうちどれを実行するか
   * インデックスを返却する
   * ここか優先行動の配列を変更のこと
   *
   * @returns number インデックス
   */
  action(actionList) {
    return this.selectByPrior(actionList, this.createActionPrior());
  }
  /**
   * 選択肢のうちどれを実行するか
   *
   * @param faireList 可能なコマンド
   * @param divId アクションの識別子
   *
   * @returns 実行するコマンドのインデックス
   */
  choose(faireList, divId) {
    this.logger({
      list: faireList,
      divId
    });
    if (faireList.some(f => f.action === 'alimentation')) {
      return this.alimentation(faireList);
    }
    if (faireList.some(f => f.action === 'choisirAction')) {
      // 増築・厩
      if (['dvActionPiecesEtables'].includes(divId)) {
        return this.houseStable(faireList);
      }
      // 種をまくそして/またはパンを焼く
      if (['dvActionSemaillesCuissonPain'].includes(divId)) {
        return this.sowBake(faireList);
      }
      // 改築進歩
      if (['dvActionRenovAmenag'].includes(divId)) {
        return this.renovationImprovement(faireList);
      }
      // 家族と小進歩を出せる場合は一緒に出す
      if (['dvActionNaissAmenag'].includes(divId)) {
        return this.familyImprovement(faireList);
      }
      // 畑を耕すそして/または種をまく
      if (['dvActionSemaillesLabourer'].includes(divId)) {
        return this.ploughingSow(faireList);
      }
    }
    if (faireList.some(f => f.action === 'faireAction')) {
      // 家を建てる場所
      if (['dvActionPiece'].includes(divId)) {
        return this.house(faireList);
      }
      // 厩を建てる場所 TODO divId
      if (faireList.some(f => ['5b'].includes(f.val))) {
        return this.stable(faireList);
      }
      // 畑を耕す場所 TODO divId 畑種
      if (faireList.some(f => ['3', '42b', '42f'].includes(f.val)) || ['dvActionLabourage'].includes(divId)) {
        return this.ploughing(faireList);
      }
      // 小進歩 TODO divId start
      if (faireList.some(f => ['1'].includes(f.val)) || ['dvAmenagement36b'].includes(divId)) {
        return this.minorImprovement(faireList);
      }
      // 大進歩
      if (['dvAmenagement32', 'dvAmenagement35b'].includes(divId)) {
        return this.majorImprovement(faireList);
      }
      // 職業
      if (['dvSavoirFaire12'].includes(divId)) {
        return this.occupation(faireList);
      }
    }
    this.logger({
      choise: 'random'
    });
    return Math.floor(Math.random() * faireList.length);
  }
  /**
   * 収穫
   * 収穫時に食料の変換を行うならここをオーバーライドすること
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  alimentation(faireList) {
    // 食事の時間は食材の変換を行わない
    return faireList.findIndex(f => f.action === 'alimentation');
  }
  /**
   * 増築・厩
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  houseStable(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createHouseStablePrior());
  }
  /**
   * 増築（場所）
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  house(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement.split('|')[0]), this.createHousePrior());
  }
  /**
   * 厩（場所）
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  stable(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createStablePrior());
  }
  /**
   * 種をまく・パンを焼く
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  sowBake(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createSowBakePrior());
  }
  /**
   * 改築・進歩
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  renovationImprovement(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createRenovationImprovementPrior());
  }
  /**
   * 家族を増やす・小進歩
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  familyImprovement(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createFamilyMinorImprovementPrior());
  }
  /**
   * 大きな進歩
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  minorImprovement(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement.split('|')[0]), this.createMinorImprovementPrior());
  }
  /**
   * 大きな進歩
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  majorImprovement(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement.toString().includes('|') ? f.complement.toString().split('|')[0] : f.complement), this.createMajorImprovementPrior());
  }
  /**
   * 畑を耕す
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  ploughing(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createPloughingPrior());
  }
  /**
   * 畑を耕す・種をまく
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  ploughingSow(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement), this.createPloughingSowPrior());
  }
  /**
   * 職業
   *
   * @param 可能なコマンド
   *
   * @returns 実行するコマンドのインデックス
   */
  occupation(faireList) {
    return this.selectByPrior(faireList.map(f => f.complement.split('|')[0]), this.createOccupationPrior());
  }
  
  // ------------------------------------------------
  // 基本的にこの下だけをオーバーライドすればAIは作れる
  // ------------------------------------------------
  /**
   * 柵を立てる
   * AI側でオーバーライドのこと
   *
   * @param 今の柵の状態
   *
   * @returns 完成形の柵
   */
  fences(fenceList) {
    return [
      {
        x: 2,
        y: 4,
        z: 0
      },
      {
        x: 2,
        y: 4,
        z: 1
      },
      {
        x: 2,
        y: 4,
        z: 2
      },
      {
        x: 2,
        y: 4,
        z: 3
      }
    ];
  }
  /**
   * 種をまく
   *
   * @param sems {[name: string]: {[key: SOWABLE]: number}} 返す入力値のオブジェクト
   *
   * @returns {[name: string]: SOWABLE} 返す入力値
   */
  sow(sems) {
    const rSow = {};
    const first = Object.keys(sems)[0];
    rSow[first] = SOWABLE.GRAIN;
    return rSow;
  }
  /**
   * パンを焼く
   *
   * @param cuires [{[name: string]: value}] 焼ける小麦量のオブジェクト
   *
   * @returns number[] 焼く小麦量
   */
  cuire(cuires) {
    const rCuire = Object.keys(cuires).map(() => 0);
    rCuire[0] = 1;
    return rCuire;
  }
  /**
   * 動物を牧場に入れる
   *
   * @param mRef 今いる羊量
   * @param sRef 今いる猪量
   * @param bfRef 今いる牛量
   * @param capacity {se: {[key: string]: number}, am: {[key: string]: number}} 各要素にどれだけ割り振れるか
   *
   * @returns {se: {[key: string]: {m: number, s: number, bf: number}}, am: {[key: string]: {m: number, s: number, bf: number}}} 動物の割り振り
   */
  valider(mRef, sRef, bfRef, capacity) {
    const ret = {
      se: {},
      am: {}
    };
    Object.keys(capacity.se).forEach(n => {
      ret.se[n] = {
        m: 0,
        s: 0,
        bf: 0
      };
    });
    Object.keys(capacity.am).forEach(n => {
      ret.am[n] = {
        m: 0,
        s: 0,
        bf: 0
      };
    });
    const lastAmN = Object.keys(ret.am).pop();
    ret.am[lastAmN].m = mRef;
    ret.am[lastAmN].s = sRef;
    ret.am[lastAmN].bf = bfRef;
    
    return ret;
  }
  /**
   * 食事の時間です。
   */
  lunch (cmds, danger) {
    return cmds.map(c => c.action).indexOf('alimentation');
  }
  // 優先する配列のジェネレータ
  /**
   * ドラフト
   */
  createDraftPrior(amPicked, sfPicked) {
    return {
      am: [],
      sf: []
    };
  }
  /**
   * アクション
   */
  createActionPrior() {
    return [
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
  }
  // アクションの追加選択肢
  /**
   * 増築・厩
   */
  createHouseStablePrior() {
    return ['5a,5b', '5b,5a', '5a', '5b'];
  }
  /**
   * 種をまくそして/またはパンを焼く
   */
  createSowBakePrior() {
    return ['34a,34b', '34b,34a', '34a', '34b'];
  }
  /**
   * 改築・進歩
   */
  createRenovationImprovementPrior() {
    return ['35a,35b', '35a'];
  }
  /**
   * 家族を増やす・小進歩
   */
  createFamilyMinorImprovementPrior() {
    return ['36a,36b', '36a'];
  }
  /**
   * 畑を耕すそして/または種をまく
   */
  createPloughingSowPrior() {
    return ['42b,42a', '42a,42b', '42a', '42b'];
  }
  // 詳細選択
  /**
   * 家の配置
   */
  createHousePrior() {
    return ['1;1', '2;1', '1;2', '2;2'];
  }
  /**
   * 厩の配置
   */
  createStablePrior() {
    return ['1;3', '2;3', '1;4', '2;4'];
  }
  /**
   * 畑の配置
   */
  createPloughingPrior() {
    return ['0;0', '0;1', '0;2', '0;3', '0;4'];
  }
  /**
   * 小進歩
   */
  createMinorImprovementPrior() {
    return [];
  }
  /**
   * 大進歩
   */
  createMajorImprovementPrior() {
    return [IMPROVEMENTS.FIREPLACE2, IMPROVEMENTS.FIREPLACE3, IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5, ...this.createMinorImprovementPrior()];
  }
  /**
   * 職業
   */
  createOccupationPrior() {
    return [];
  }
};

module.exports = AIBase;