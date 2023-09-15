import RequestManager, { ContractFactory, HTTPProvider, bytesToHex } from 'eth-connect'
import { AppComponents } from '../types'
import { createLowerCaseKeysCache } from './lowercase-keys-cache'

const l1Contracts = {
  mainnet: {
    chainId: 1,
    registrar: '0x2a187453064356c898cae034eaed119e1663acb8',
    land: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
    state: '0x959e104e1a4db6317fa58f8295f586e1a978c297',
    nameDenylist: '0x0c4c90a4f29872a2e9ef4c4be3d419792bca9a36',
    catalyst: '0x4a2f10076101650f40342885b99b6b101d83c486',
    checker: '0x49fd6E40548A67a3FB9cA4fE22ab87885ba10454',
    manaToken: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'
  },
  sepolia: {
    chainId: 11155111,
    registrar: '0x7518456ae93eb98f3e64571b689c626616bb7f30',
    land: '0x42f4ba48791e2de32f5fbf553441c2672864bb33',
    state: '0x369a7fbe718c870c79f99fb423882e8dd8b20486',
    nameDenylist: '0x6082b0b10b0fe9040652e35acbf3a22fe6764f27',
    catalyst: '0x9b5091588a4bae0a5ea54a35af3c31f57a68ed37',
    checker: '0x49fd6E40548A67a3FB9cA4fE22ab87885ba10454',
    manaToken: '0xfa04d2e2ba9aec166c93dfeeba7427b2303befa9'
  }
}

type CatalystByIdResult = {
  id: string
  owner: string
  domain: string
}

type CatalystContract = {
  catalystCount(): Promise<number>
  catalystIds(i: number): Promise<string>
  catalystById(id: string): Promise<CatalystByIdResult>
}

type CatalystServerInfo = {
  address: string
  owner: string
  id: string
}

const catalystAbi = [
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    name: 'owners',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'hasInitialized',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'catalystCount',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '_script',
        type: 'bytes'
      }
    ],
    name: 'getEVMScriptExecutor',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'getRecoveryVault',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'catalystIndexById',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '_id',
        type: 'bytes32'
      }
    ],
    name: 'catalystOwner',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '_id',
        type: 'bytes32'
      }
    ],
    name: 'catalystAddress',
    outputs: [
      {
        name: '',
        type: 'string'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    name: 'catalystIds',
    outputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'token',
        type: 'address'
      }
    ],
    name: 'allowRecoverability',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'appId',
    outputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [],
    name: 'initialize',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'getInitializationBlock',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_token',
        type: 'address'
      }
    ],
    name: 'transferToVault',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '_sender',
        type: 'address'
      },
      {
        name: '_role',
        type: 'bytes32'
      },
      {
        name: '_params',
        type: 'uint256[]'
      }
    ],
    name: 'canPerform',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'getEVMScriptRegistry',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_id',
        type: 'bytes32'
      }
    ],
    name: 'removeCatalyst',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'addresss',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'catalystById',
    outputs: [
      {
        name: 'id',
        type: 'bytes32'
      },
      {
        name: 'owner',
        type: 'address'
      },
      {
        name: 'address',
        type: 'string'
      },
      {
        name: 'startTime',
        type: 'uint256'
      },
      {
        name: 'endTime',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_owner',
        type: 'address'
      },
      {
        name: '_address',
        type: 'string'
      }
    ],
    name: 'addCatalyst',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'kernel',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'MODIFY_ROLE',
    outputs: [
      {
        name: '',
        type: 'bytes32'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'isPetrified',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: '_id',
        type: 'bytes32'
      },
      {
        indexed: true,
        name: '_owner',
        type: 'address'
      },
      {
        indexed: false,
        name: '_address',
        type: 'string'
      }
    ],
    name: 'AddCatalyst',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: '_id',
        type: 'bytes32'
      },
      {
        indexed: true,
        name: '_owner',
        type: 'address'
      },
      {
        indexed: false,
        name: '_address',
        type: 'string'
      }
    ],
    name: 'RemoveCatalyst',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'executor',
        type: 'address'
      },
      {
        indexed: false,
        name: 'script',
        type: 'bytes'
      },
      {
        indexed: false,
        name: 'input',
        type: 'bytes'
      },
      {
        indexed: false,
        name: 'returnData',
        type: 'bytes'
      }
    ],
    name: 'ScriptResult',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'vault',
        type: 'address'
      },
      {
        indexed: true,
        name: 'token',
        type: 'address'
      },
      {
        indexed: false,
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'RecoverToVault',
    type: 'event'
  }
]

async function getCatalystServersFromDAO(contract: CatalystContract): Promise<CatalystServerInfo[]> {
  const nodes: CatalystServerInfo[] = []
  for (let i = 0; i < (await contract.catalystCount()); i++) {
    const record = await contract.catalystById(await contract.catalystIds(i))
    const { id, owner, domain } = record
    if (domain.startsWith('http://')) {
      console.warn('Catalyst node address using http protocol, skipping')
      continue
    }

    let address = domain

    if (!address.startsWith('https://')) {
      address = 'https://' + address
    }

    // trim url in case it starts/ends with a blank
    address = address.trim()

    nodes.push({
      address,
      owner,
      id
    })
  }

  return nodes
}

export type CatalystProvider = {
  getCatalysts(network: string): Promise<string[]>
}

async function createContract(address: string, provider: HTTPProvider): Promise<CatalystContract> {
  const requestManager = new RequestManager(provider)
  const factory = new ContractFactory(requestManager, catalystAbi)
  const contract = (await factory.at(address)) as any
  return {
    async catalystCount(): Promise<number> {
      return contract.catalystCount()
    },
    async catalystIds(i: number): Promise<string> {
      return contract.catalystIds(i)
    },
    async catalystById(catalystId: string): Promise<CatalystByIdResult> {
      const [id, owner, domain] = await contract.catalystById(catalystId)
      return { id: '0x' + bytesToHex(id), owner, domain }
    }
  }
}

export async function createCatalystProvider({
  fetch,
  logs
}: Pick<AppComponents, 'fetch' | 'logs'>): Promise<CatalystProvider> {
  const logger = logs.getLogger('realm-provider')
  const opts = { fetch: fetch.fetch }
  const mainnet = new HTTPProvider('https://rpc.decentraland.org/mainnet?project=catalyst-contracts-ci', opts)
  const sepolia = new HTTPProvider('https://rpc.decentraland.org/sepolia?project=catalyst-contracts-ci', opts)

  // make lazy initialization
  const mainnetContract = await createContract(l1Contracts.mainnet.catalyst, mainnet)
  const sepoliaContract = await createContract(l1Contracts.sepolia.catalyst, sepolia)

  async function getCatalysts(network: string) {
    switch (network) {
      case 'mainnet':
        return getCatalystServersFromDAO(mainnetContract).then((servers) => servers.map((s) => s.address))
      case 'sepolia':
        return getCatalystServersFromDAO(sepoliaContract).then((servers) => servers.map((s) => s.address))
      default:
        throw new Error(`Network ${network} not supported`)
    }
  }

  const cache = createLowerCaseKeysCache<string[]>({
    max: 10000,
    ttl: 6000000, // 100 minutes
    fetchMethod: async function (network: string, staleValue: string[] | undefined) {
      try {
        const es = await getCatalysts(network)
        return es
      } catch (err: any) {
        logger.error(err)
        return staleValue
      }
    }
  })

  return {
    async getCatalysts(network: string) {
      const realms = await cache.fetch(network)
      if (realms) {
        return realms
      }
      throw new Error(`Cannot fetch catalysts for ${network}`)
    }
  }
}
