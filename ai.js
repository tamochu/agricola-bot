const { IMPROVEMENTS, OCCUPATIONS, ACTIONS, SOWABLE, MAJOR_IMPROVEMENTS, MINOR_IMPROVEMENTS, RESOURCES, RESOURCE_ACTIONS, IMPROVEMENT_DETAILS } = require('./constants');
const { EVALUATION_IMPROVEMENTS, EVALUATION_OCCUPATIONS } = require('./evaluationReference');
const AIBase = require('./aiBase');

const OCCUPIED = 'occupiedAction';
const MAJOR_IMPROVEMENT = 'majorImprovementAction';
const MINOR_IMPROVEMENT = 'minorImprovementAction';
const START_PLAYER = 'startPlayerAction';
const FENCE = 'fenceAction';


const AI = class extends AIBase {
  /**
   * このAIの職業評価（＝対応済みの職業）
   */
  myEvaluationOccupation() {
    return Object.assign({}, EVALUATION_OCCUPATIONS, {
      [OCCUPATIONS.CLAY_WORKER]: 800
    });
  }
  /**
   * 柵を立てる
   *
   * @param 今の柵の状態
   *  x:上からのブロックのindex
   *  y:左からのブロックのindex
   *  z:ブロックの上辺:0右辺:1(y=4のブロックにのみ存在)下辺:2(x=2のブロックにのみ存在)左辺:3
   *
   * @returns 完成形の柵
   */
  fences(fenceList) {
    return [
      {
        x: 1,
        y: 2,
        z: 0
      },
      {
        x: 1,
        y: 2,
        z: 3
      },
      {
        x: 1,
        y: 3,
        z: 0
      },
      {
        x: 1,
        y: 3,
        z: 3
      },
      {
        x: 1,
        y: 4,
        z: 0
      },
      {
        x: 1,
        y: 4,
        z: 1
      },
      {
        x: 1,
        y: 4,
        z: 3
      },
      {
        x: 2,
        y: 2,
        z: 3
      },
      {
        x: 2,
        y: 2,
        z: 2
      },
      {
        x: 2,
        y: 3,
        z: 0
      },
      {
        x: 2,
        y: 3,
        z: 3
      },
      {
        x: 2,
        y: 3,
        z: 2
      },
      {
        x: 2,
        y: 4,
        z: 3
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
      }
    ];
  }
  /**
   * 種をまく
   */
  sow(sems) {
    const rSow = {};
    const myInfo = this.myInfo();
    let grainRest = myInfo.grain;
    let vegetableRest = myInfo.vegetable;
    let vegetableSum = myInfo.vegetable + myInfo.fieldDetail.vegetable.reduce((s, v) => s + v, 0);
    Object.keys(sems).forEach(k => {
      if (vegetableSum < 4 && vegetableRest > 0) {
        rSow[k] = SOWABLE.VEGETABLE;
        vegetableRest--;
        vegetableSum++;
        return
      }
      if (grainRest > 0) {
        rSow[k] = SOWABLE.GRAIN;
        grainRest--;
        return
      }
      if (vegetableRest > 0) {
        rSow[k] = SOWABLE.VEGETABLE;
        vegetableRest--;
        vegetableSum++;
        return
      }
    });
    return rSow;
  }
  /**
   * パンを焼く
   */
  // TODO 実装
  // とりあえずデフォのものを用いる
  /*
  cuire(cuires) {
    const rCuire = Object.keys(cuires).map(() => 0);
    rCuire[0] = 1;
    return rCuire;
  }
  */
  /**
   * 動物を牧場に入れる。
   * 牛>猪>羊で入るだけ入れる（入れ方は全く考えない）。
   */
  valider(mRef, sRef, bfRef, capacity) {
    let bf = bfRef;
    let s = sRef;
    let m = mRef;
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
      if (bf > 0) {
        const bfIn = Math.min(bf, capacity.se[n].bf);
        ret.se[n].bf = bfIn;
        bf -= bfIn;
        return;
      }
      if (s > 0) {
        const sIn = Math.min(s, capacity.se[n].s);
        ret.se[n].s = sIn;
        s -= sIn;
        return;
      }
      if (m > 0) {
        const mIn = Math.min(m, capacity.se[n].m);
        ret.se[n].m = mIn;
        m -= mIn;
        return;
      }
    });
    Object.keys(capacity.am).reverse().forEach(n => {
      ret.am[n] = {
        m: 0,
        s: 0,
        bf: 0
      };
      if (bf > 0) {
        const bfIn = Math.min(bf, capacity.am[n].bf);
        ret.am[n].bf = bfIn;
        bf -= bfIn;
      }
      if (s > 0) {
        const sIn = Math.min(s, capacity.am[n].s);
        ret.am[n].s = sIn;
        s -= sIn;
      }
      if (m > 0) {
        const mIn = Math.min(m, capacity.am[n].m);
        ret.am[n].m = mIn;
        m -= mIn;
      }
    });
    
    return ret;
  }
  /**
   * 食事の時間です。
   */
  lunch (cmds, danger) {
    if (danger) {
      const myInfo = this.myInfo();
      if (myInfo.vegetable > 4) {
        return cmds.findIndex(c => c.action === 'faireCuisson' && c.complement === 0);
      }
      if (myInfo.cattle > 2) {
        return cmds.findIndex(c => c.action === 'faireCuisson' && c.complement === 3);
      }
      if (myInfo.boar > 2) {
        return cmds.findIndex(c => c.action === 'faireCuisson' && c.complement === 2);
      }
      if (myInfo.sheep > 2) {
        return cmds.findIndex(c => c.action === 'faireCuisson' && c.complement === 1);
      }
      if (cmds.filter(c => c.action === 'faireCuisson').length > 0) {
        return cmds.findIndex(c => c.action === 'faireCuisson');
      }
      if (cmds.filter(c => c.action === 'faireEchange').length > 0) {
        return cmds.findIndex(c => c.action === 'faireEchange');
      }
    }
    return cmds.map(c => c.action).indexOf('alimentation');
  }
  /**
   * ドラフト
   */
  createDraftPrior(amPicked, sfPicked) {
    return {
      am: Object.keys(EVALUATION_IMPROVEMENTS).sort((a, b) => EVALUATION_IMPROVEMENTS[b] - EVALUATION_IMPROVEMENTS[a]),
      sf: Object.keys(this.myEvaluationOccupation()).sort((a, b) => this.myEvaluationOccupation()[b] - this.myEvaluationOccupation()[a])
    };
  }
  /**
   * 調理効率の取得
   */
  getFoodCookMulti(r) {
    const myInfo = this.myInfo();
    
    if (this.canCookAnimal()) {
      switch (r) {
        case RESOURCES.SHEEP:
          return [IMPROVEMENTS.FIREPLACE2, IMPROVEMENTS.FIREPLACE3, IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 2 :
                      [IMPROVEMENTS.SIMPLE_FIREPLACE].some(ch => myInfo.cards.includes(ch)) ? 1 : 0;
        case RESOURCES.BOAR:
          return [IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 3 : 2;
        case RESOURCES.CATTLE:
          return [IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 4 : 3;
      }
    }
    
    return 1;
  }
  /**
   * アクション評価オブジェクト取得
   */
  createActionEvaluator() {
    const myInfo = this.myInfo();
    
    const evalFoodAction = a => {
      let foodMul = 1;
      // TODO 職業と進歩の評価
      switch (a) {
        case ACTIONS.DAY_LABOURER:
          return 2;
        case ACTIONS.FISHING:
          break;
        case ACTIONS.SHEEP1:
          foodMul = this.getFoodCookMulti(RESOURCES.SHEEP);
          break;
        case ACTIONS.BOAR1:
          foodMul = this.getFoodCookMulti(RESOURCES.BOAR);
          break;
        case ACTIONS.CATTLE1:
          foodMul = this.getFoodCookMulti(RESOURCES.CATTLE);
          break;
        default:
          break;
      }
      return this.info.resource[a] ? (this.info.resource[a] * foodMul) : 0;
    };
    
    const actionEvaluator = {};
    const addActionEvaluator = (action, needs, costs, earns, multi) => {
      if (!actionEvaluator[action]) {
        actionEvaluator[action] = {
          needs,
          costs,
          earns,
          multi
        };
        return;
      }
      actionEvaluator[action] = {
        needs: Object.assign(actionEvaluator[action].needs, needs),
        costs: Object.assign(actionEvaluator[action].costs, costs),
        earns: [...actionEvaluator[action].earns, ...earns],
        multi: [...actionEvaluator[action].multi, ...multi]
      };
    };
    const foodActions = [ACTIONS.DAY_LABOURER, ACTIONS.FISHING];
    if (this.canCookAnimal()) {
      foodActions.push(ACTIONS.SHEEP1);
      foodActions.push(ACTIONS.BOAR1);
      foodActions.push(ACTIONS.CATTLE1);
    }
    foodActions.forEach(a => addActionEvaluator(a, {}, {}, [
        {
          resource: RESOURCES.FOOD,
          num: evalFoodAction(a),
          must: true
        }
      ], [])
    );
    Object.keys(RESOURCE_ACTIONS).forEach(r => {
      RESOURCE_ACTIONS[r].forEach(a => addActionEvaluator(a, {}, {}, [
        {
          resource: r,
          num: this.info.resource[a] ? this.info.resource[a] : 0,
          must: true
        }
      ], [])
    )});
    addActionEvaluator(ACTIONS.HOUSE_STABLE, {}, {
      [RESOURCES.ROOMS]: n => {
        const c = {
          [RESOURCES.REED]: 2 * n
        };
        const material = myInfo.roomLevel === 1 ? RESOURCES.WOOD :
                          myInfo.roomLevel === 2 ? RESOURCES.CLAY :
                          myInfo.roomLevel === 3 ? RESOURCES.STONE : 'unknown';
        c[material] = 5 * n; 
        return c;
      },
      [RESOURCES.STABLE]: n => ({
        [RESOURCES.WOOD]: 2 * n
      })
    }, [
      {
        resource: RESOURCES.ROOMS,
        num: 1,
        must: false
      },
      {
        resource: RESOURCES.STABLE,
        num: 1,
        must: false
      }
    ], [RESOURCES.ROOMS, RESOURCES.STABLE]);
    addActionEvaluator(ACTIONS.OCCUPATION1_1, {}, {
      [RESOURCES.SF_LENGTH]: () => ({
        [RESOURCES.FOOD]: myInfo[RESOURCES.SF_LENGTH] == 0 ? 0 : 1
      })
    }, [
      {
        resource: RESOURCES.SF_LENGTH,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.FAMILY_MINOR_IMPROVEMENT, {
      [RESOURCES.FAMILY]: () => ({
        [RESOURCES.GROWABLE_FAMILY]: 1
    })}, {
      [RESOURCES.FAMILY]: () => ({
        [RESOURCES.ROOMS]: myInfo[RESOURCES.FAMILY] + 1
    })}, [
      {
        resource: RESOURCES.FAMILY,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.START_PLAYER_MINOR_IMPROVEMENT, {}, {}, [
      {
        resource: MINOR_IMPROVEMENT,
        num: 1,
        must: false
      },
      {
        resource: START_PLAYER,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.FENCES, {
      [FENCE]: () => ({
        [RESOURCES.FENCE]: 15
      })
    }, {
      [FENCE]: () => ({
        [RESOURCES.WOOD]: 15
      })
    }, [
      {
        resource: FENCE,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.IMPROVEMENT, {}, {}, [
      {
        resource: MAJOR_IMPROVEMENT,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.RENOVATION_IMPROVEMENT, {
      [RESOURCES.ROOM_LEVEL]: () => ({
        [OCCUPIED]: myInfo[RESOURCES.ROOM_LEVEL] === 3 ? 1 : 0
      })
    }, {
      [RESOURCES.ROOM_LEVEL]: () => ({
        [RESOURCES.REED]: 1,
        [myInfo[RESOURCES.ROOM_LEVEL] === 1 ? RESOURCES.CLAY : RESOURCES.STONE]: myInfo[RESOURCES.ROOMS]
      })
    }, [
      {
        resource: RESOURCES.ROOM_LEVEL,
        num: 1,
        must: true
      },
      {
        resource: MAJOR_IMPROVEMENT,
        num: 1,
        must: false
      }
    ], []);
    addActionEvaluator(ACTIONS.SOW_BAKING_BREAD, {}, {
      [RESOURCES.GRAIN_FIELD]: n => ({
        [RESOURCES.BLANK_FIELD]: n,
        [RESOURCES.GRAIN]: n
      }),
      [RESOURCES.VEGETABLE_FIELD]: n => ({
        [RESOURCES.BLANK_FIELD]: n,
        [RESOURCES.VEGETABLE]: n
      })
    }, [ // TODO パンを焼く
      {
        resource: RESOURCES.GRAIN_FIELD,
        num: 1,
        must: false
      },
      {
        resource: RESOURCES.VEGETABLE_FIELD,
        num: 1,
        must: false
      }
    ], [RESOURCES.GRAIN_FIELD, RESOURCES.VEGETABLE_FIELD]);
    addActionEvaluator(ACTIONS.PLOUGHING, {}, {}, [
      {
        resource: RESOURCES.BLANK_FIELD,
        num: 1,
        must: true
      }
    ], []);
    addActionEvaluator(ACTIONS.PLOUGHING_SOW, {}, {
      [RESOURCES.GRAIN_FIELD]: n => ({
        [RESOURCES.GRAIN]: n
      }),
      [RESOURCES.VEGETABLE_FIELD]: n => ({
        [RESOURCES.VEGETABLE]: n
      })
    }, [
      {
        resource: RESOURCES.BLANK_FIELD,
        num: 1,
        must: false
      },
      {
        resource: RESOURCES.GRAIN_FIELD,
        num: 1,
        must: false
      },
      {
        resource: RESOURCES.VEGETABLE_FIELD,
        num: 1,
        must: false
      }
    ], [RESOURCES.GRAIN_FIELD, RESOURCES.VEGETABLE_FIELD]);
    MAJOR_IMPROVEMENTS.forEach(maAm => addActionEvaluator(`getAM${maAm}`, {
      [RESOURCES.AM]: () => Object.assign({}, IMPROVEMENT_DETAILS[maAm].needs, IMPROVEMENT_DETAILS[maAm].costs, {
        [OCCUPIED]: Object.keys(this.info.player).every(i => !this.info.player[i].cards.includes(maAm)) ? 0 : 1
      })
    }, {
      [RESOURCES.AM]: () => ({
        [MAJOR_IMPROVEMENT]: 1
      })
    }, [
      {
        resource: RESOURCES.AM,
        num: maAm,
        must: true
      }
    ], []));
    // 職業による効果
    if (myInfo.cards.includes(OCCUPATIONS.CLAY_WORKER)) {
      [...RESOURCE_ACTIONS[RESOURCES.WOOD], ...RESOURCE_ACTIONS[RESOURCES.CLAY], ACTIONS.REED_WOOD_STONE].forEach(a => addActionEvaluator(a, {}, {}, [
        {
          resource: RESOURCES.CLAY,
          num: 1,
          must: true
        }
      ], []))
    }
    
    return actionEvaluator;
  }
  /**
   * 目標配列
   */
  createGoals() {
    const myInfo = this.myInfo();
    
    let animalCookableEvalFoods = 0;
    if (this.canCookAnimal()) {
      const animals = {
        [RESOURCES.SHEEP]: 8,
        [RESOURCES.BOAR]: 7,
        [RESOURCES.CATTLE]: 6
      }
      Object.keys(animals).forEach(r => {
        if (myInfo[r] > animals[r]) {
          animalCookableEvalFoods += this.getFoodCookMulti(r) * (myInfo[r] - animals[r]);
        } else if (myInfo[r] > 2) {
          animalCookableEvalFoods += Math.floor(this.getFoodCookMulti(r) * (myInfo[r] - 2) / 2);
        }
      });
    }
    
    // 目標配列
    const goals = [
      // 収穫時の食料確保
      {
        pt: 500,
        goal: {
          [RESOURCES.FOOD]: Math.max(myInfo[RESOURCES.FAMILY] * 2 - animalCookableEvalFoods, 0)
        },
        org: '食料基本'
      },
      // 家族を3人にする
      {
        pt: 1000,
        goal: {
          [RESOURCES.FAMILY]: 3
        },
        org: '家族3人'
      },
      // 職業を一つ出す TODO 優先職業を作る
      {
        pt: 500,
        goal: {
          [RESOURCES.SF_LENGTH]: 1
        },
        org: '職業1'
      },
      // レンガの家に住む
      {
        pt: 400,
        goal: {
          [RESOURCES.ROOM_LEVEL]: 2
        },
        org: 'レンガの家'
      },
      // 畑を2にする
      {
        pt: 400,
        goal: {
          [RESOURCES.FIELDS]: 2
        },
        org: '畑2'
      },
      // 畑を3にする
      {
        pt: 100,
        goal: {
          [RESOURCES.FIELDS]: 3
        },
        org: '畑3'
      },
      // 畑を4にする
      {
        pt: 100,
        goal: {
          [RESOURCES.FIELDS]: 4
        },
        org: '畑4'
      },
      // 畑を5にする
      {
        pt: 100,
        goal: {
          [RESOURCES.FIELDS]: 5
        },
        org: '畑5'
      },
      // 家族を4人にする
      {
        pt: 100,
        goal: {
          [RESOURCES.FAMILY]: 4
        },
        org: '家族4人'
      },
      // 石の家に住む
      {
        pt: 50,
        goal: {
          [RESOURCES.ROOM_LEVEL]: 3
        },
        org: '石の家'
      },
      // 最後までの食料確保
      {
        pt: 10,
        goal: {
          [RESOURCES.FOOD]: Math.max((this.info.round <= 4 ? 34 :
                            this.info.round <= 7 ? 30 :
                            this.info.round <= 9 ? 24 :
                            this.info.round <= 11 ? 18 :
                            this.info.round <= 13 ? 12 : 6) - animalCookableEvalFoods, 0)
        },
        org: '食料全体'
      }
    ];
    if ([4, 7, 9, 11, 13, 14].includes(this.info.round)) {
      goals.push({
        pt: 1500,
        goal: {
          [RESOURCES.FOOD]: Math.max(myInfo[RESOURCES.FAMILY] * 2 - animalCookableEvalFoods, 0)
        },
        org: '食料喫緊'
      });
    }
    // かまど2をとれるなら取る
    if (!this.canCookAnimal()) {
      goals.push({
        pt: 600,
        goal: {
          [RESOURCES.AM]: IMPROVEMENTS.FIREPLACE2
        },
        org: 'かまど2'
      });
    }
    
    // 畑
    const vegetableSum = myInfo.vegetable + myInfo.fieldDetail.vegetable.reduce((s, v) => s + v, 0);
    const grainSum = myInfo.grain + myInfo.fieldDetail.grain.reduce((s, v) => s + v, 0);
    // 種を植える
    if (myInfo.fieldDetail.blank >= 2) {
      if (myInfo.grain + myInfo.vegetable >= 2) {
        if (vegetableSum < 4) {
          goals.push({
            pt: 400,
            goal: {
              [RESOURCES.VEGETABLE_FIELD]: myInfo.vegetableField + 1
            },
            org: '野菜畑'
          });
        }
        if (grainSum < 8) {
          goals.push({
            pt: 300,
            goal: {
              [RESOURCES.GRAIN_FIELD]: myInfo.grainField + 1
            },
            org: '小麦畑'
          });
        }
      } else {
        if (vegetableSum < 4) {
          goals.push({
            pt: 120,
            goal: {
              [RESOURCES.VEGETABLE]: 1
            },
            org: '野菜種'
          });
        }
        if (grainSum < 8) {
          goals.push({
            pt: 100,
            goal: {
              [RESOURCES.GRAIN]: 1
            },
            org: '小麦種'
          });
        }
      }
    }
    // 少なくとも野菜1つはとる
    if (vegetableSum <= 0) {
      goals.push({
        pt: 100,
        goal: {
          [RESOURCES.VEGETABLE]: 1
        },
        org: '野菜1'
      });
    }
    // 少なくとも小麦1つはとる
    if (grainSum <= 0) {
      goals.push({
        pt: 100,
        goal: {
          [RESOURCES.GRAIN]: 1
        },
        org: '小麦1'
      });
    }
    
    // ラス手番ならスタプを取りに行く TODO 小進歩材をとってから
    if ((this.info.first + 1) % Object.keys(this.info.player).length === this.info.iam) {
      goals.push({
        pt: 200,
        goal: {
          [START_PLAYER]: 1
        },
        org: 'スタプ'
      });
    }
    
    // 柵を立てる
    if (myInfo.fence === 15) {
      goals.push({
        pt: 400,
        goal: {
          [FENCE]: 1
        },
        org: '柵'
      });
    } else {
      // 柵が建っていたら中身を入れる
      goals.push({
        pt: 200,
        goal: {
          [RESOURCES.CATTLE]: 6
        },
        org: '中身牛'
      });
      goals.push({
        pt: 200,
        goal: {
          [RESOURCES.BOAR]: 7
        },
        org: '中身猪'
      });
      goals.push({
        pt: 200,
        goal: {
          [RESOURCES.SHEEP]: 8
        },
        org: '中身羊'
      });
    }
    
    return goals;
  }
  /**
   * アクション
   */
  createActionPrior() {
    const myInfo = this.myInfo();
    const safeGetMyInfo = key => (myInfo[key] ? myInfo[key] : 0);
    // 評価オブジェクト
    const actionEvaluator = this.createActionEvaluator();
    // 目標
    const goals = this.createGoals();
    
    const resourceToActionPts = (resource, num, ptPerResource, org) => {
      return Object.keys(actionEvaluator)
      .filter(a => actionEvaluator[a].earns.some(e => e.resource === resource && (![RESOURCES.AM, RESOURCES.SF].includes(resource) || e.num === num)))
      .map(a => {
        return {
          action: a,
          pt: actionEvaluator[a].earns.filter(e => e.resource === resource).reduce((spt, e) => spt + e.num, 0) * ptPerResource,
          resource,
          org
        };
      })};
    const expandGoals = gs => {
      const actionPts = gs.filter(g => Object.keys(g.goal).reduce((r, goalRes) => {
        if ([RESOURCES.AM, RESOURCES.SF].includes(goalRes)) {
          if (!safeGetMyInfo(goalRes).includes(g.goal[goalRes])) {
            return true;
          }
        } else {
          if (g.goal[goalRes] > safeGetMyInfo(goalRes)) {
            return true;
          }
        }
        return r;
      }, false)).map(g => {
        const goalResources = Object.keys(g.goal)
        const sumNeeds = goalResources.reduce((sum, r) => {
          if ([RESOURCES.AM, RESOURCES.SF].includes(r)) {
            if (!safeGetMyInfo(r).includes(g.goal[r])) {
              return sum + 1;
            }
            return sum;
          }
          if (g.goal[r] <= safeGetMyInfo(r)) {
            return sum;
          }
          return sum + g.goal[r] - safeGetMyInfo(r);
        }, 0);
        return goalResources.map(r => resourceToActionPts(r, g.goal[r], g.pt / sumNeeds, g.org));
      }).filter(aas => aas.every(a => a.length > 0)).flat(2);
      const nextGoals = [];
      const playableActions = [];
      actionPts.forEach(ap => {
        const ae = actionEvaluator[ap.action];
        const conds = [];
        const needNum = r => ae.earns.find(e => e.resource === r).must || r === ap.resource ? 1 : 0;
        Object.keys(ae.needs).forEach(r => {
          const needfulResources = ae.needs[r](needNum(r));
          Object.keys(needfulResources).forEach(nr => {
            if (needfulResources[nr] > safeGetMyInfo(nr)) {
              conds.push({
                resource: nr,
                num: needfulResources[nr],
                shortage: needfulResources[nr] - safeGetMyInfo(nr),
                org: ap.org + 'needs'
              });
            }
          });
        });
        if (conds.length <= 0) {
          Object.keys(ae.costs).forEach(r => {
            const needfulResources = ae.costs[r](needNum(r));
            Object.keys(needfulResources).forEach(nr => {
              if (needfulResources[nr] > safeGetMyInfo(nr)) {
                conds.push({
                  resource: nr,
                  num: needfulResources[nr],
                  shortage: needfulResources[nr] - safeGetMyInfo(nr),
                  org: ap.org + 'costs'
                });
              }
            });
          });
        }
        if (conds.length > 0) {
          const sumShortage = conds.reduce((s, c) => s + c.shortage, 0);
          conds.forEach(c => {
            nextGoals.push(
              {
                pt: ap.pt * c.shortage / sumShortage,
                goal: {
                  [c.resource]: c.num
                },
                org: c.org
              }
            );
          });
        } else {
          playableActions.push(ap);
        }
      });
      return {nextGoals, playableActions};
    };
    let ngs = goals;
    const pas = [];
    let i = 0;
    while (true) {
      if (ngs.length <= 0) {
        break;
      }
      const {nextGoals, playableActions} = expandGoals(ngs);
      ngs = nextGoals;
      playableActions.forEach(pa => {
        pas.push(pa);
      });
      i++;
      if (i > 10) {
        console.log('illegal loop!');
        break;
      }
    }
    
    const actionNameMapper = a => {
      switch(a) {
        case ACTIONS.WOOD3:
          return '木3';
        case ACTIONS.CLAY1_1:
          return 'レンガ1';
        case ACTIONS.REED1:
          return '葦1';
        case ACTIONS.FISHING:
          return '漁';
        case ACTIONS.HOUSE_STABLE:
          return '増築・厩';
        case ACTIONS.START_PLAYER_AND_FOOD:
          return 'スタートプレーヤー・食料';
        case ACTIONS.GRAIN:
          return '小麦1';
        case ACTIONS.PLOUGHING:
          return '畑を耕す';
        case ACTIONS.STABLE_BREAD:
          return '厩・パンを焼く';
        case ACTIONS.DAY_LABOURER_RESOURCE:
          return '日雇い・資源';
        case ACTIONS.START_PLAYER_MINOR_IMPROVEMENT:
          return 'スタートプレーヤー・小進歩';
        case ACTIONS.OCCUPATION1_1:
          return '職業';
        case ACTIONS.DAY_LABOURER:
          return '日雇い';
        case ACTIONS.WOOD2_1:
          return '木2';
        case ACTIONS.CLAY1_2:
          return 'レンガ1';
        case ACTIONS.RESOURCE1:
          return '資源1';
        case ACTIONS.RESOURCE2:
          return '資源2';
        case ACTIONS.OCCUPATION1_2:
          return '職業';
        case ACTIONS.REED_WOOD_STONE:
          return '木石葦';
        case ACTIONS.WOOD1:
          return '木1';
        case ACTIONS.CRAY2:
          return 'レンガ2';
        case ACTIONS.TRAVELLING_PLAYERS:
          return '小劇場';
        case ACTIONS.OCCUPATION1_3:
          return '職業';
        case ACTIONS.SUPPLY:
          return '供給';
        case ACTIONS.WOOD4:
          return '木4';
        case ACTIONS.CRAY3:
          return 'レンガ3';
        case ACTIONS.OCCUPATION_OR_FAMILY:
          return '職業もしくは家族';
        case ACTIONS.HOUSE1_OR_TRAVELLING_PLAYERS:
          return '増築1もしくは小劇場';
        case ACTIONS.ANIMAL:
          return '家畜';
        case ACTIONS.SHEEP1:
          return '羊1';
        case ACTIONS.IMPROVEMENT:
          return '進歩';
        case ACTIONS.FENCES:
          return '柵';
        case ACTIONS.SOW_BAKING_BREAD:
          return '種を植える・パンを焼く';
        case ACTIONS.RENOVATION_IMPROVEMENT:
          return '改築・進歩';
        case ACTIONS.FAMILY_MINOR_IMPROVEMENT:
          return '家族を増やす・小進歩';
        case ACTIONS.STONE1_1:
          return '石1';
        case ACTIONS.BOAR1:
          return '猪1';
        case ACTIONS.VEGETABLE:
          return '野菜1';
        case ACTIONS.CATTLE1:
          return '牛1';
        case ACTIONS.STONE1_2:
          return '石1';
        case ACTIONS.PLOUGHING_SOW:
          return '畑を耕す・種を植える';
        case ACTIONS.FAMILY_WITHOUT_ROOM:
          return '家がなくても家族を増やす';
        case ACTIONS.RENOVATION_FENCES:
          return '改築・柵';
        case ACTIONS.WOOD2_2:
          return '木2';
        default:
          break;
      }
      return 'undefined';
    };
    
    const sortedPas = pas.map(pa => pa.action).filter((val, idx, arr) => arr.indexOf(val) === idx).map(a => ({
      action: a,
      pt: pas.filter(pa => pa.action === a).reduce((sumPt, pa) => sumPt + pa.pt, 0),
      org: pas.filter(pa => pa.action === a).map(pa => `${pa.org}(${pa.pt})`).join(',')
    })).filter(pa => pa.pt > 0).sort((a, b) => b.pt - a.pt);
    const prior = sortedPas.map(pa => pa.action);
    
    console.log('prior', sortedPas.map(a => `${actionNameMapper(a.action)}:${a.pt}:${a.org}`));
    this.logger({
      prior: sortedPas.map(a => `${actionNameMapper(a.action)}:${a.pt}:${a.org}`)
    });
    
    return prior;
  }
  // アクションの追加選択肢
  /**
   * 増築・厩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createHouseStablePrior() {
    return ['5a,5b', '5b,5a', '5a', '5b'];
  }
  */
  /**
   * 種をまくそして/またはパンを焼く
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createSowBakePrior() {
    return ['34a,34b', '34b,34a', '34a', '34b'];
  }
  */
  /**
   * 改築・進歩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createRenovationImprovementPrior() {
    return ['35a,35b', '35a'];
  }
  */
  /**
   * 家族を増やす・小進歩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createFamilyMinorImprovementPrior() {
    return ['36a,36b', '36a'];
  }
  */
  /**
   * 畑を耕すそして/または種をまく
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createPloughingSowPrior() {
    return ['42b,42a', '42a,42b', '42a', '42b'];
  }
  */
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
    return Object.keys(MINOR_IMPROVEMENTS).sort((a, b) => EVALUATION_IMPROVEMENTS[b] - EVALUATION_IMPROVEMENTS[a]);
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
    return Object.keys(this.myEvaluationOccupation()).sort((a, b) => this.myEvaluationOccupation()[b] - this.myEvaluationOccupation()[a]);
  }
};

module.exports = AI;