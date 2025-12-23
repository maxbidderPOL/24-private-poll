'use client'

/**
 * Private Poll Component
 * 
 * Main interface for creating polls and submitting encrypted responses.
 * Uses FHE to encrypt answers so poll creators can see statistics without 
 * seeing individual responses.
 */

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, useSwitchChain, useChainId, useBalance } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { walletClientToSigner, getSigner } from '@/lib/provider'
import { sepolia } from 'wagmi/chains'
import { formatEther } from 'viem'

const POLL_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_POLL_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000').trim()

const POLL_ABI = [
  'function createPoll(string memory _question, uint256 _minValue, uint256 _maxValue, uint256 _endTime) external returns (uint256)',
  'function submitResponse(uint256 _pollId, bytes32 _encryptedValue, bytes calldata _attestation) external',
  'function getPoll(uint256 _pollId) external view returns (string memory question, address creator, uint256 minValue, uint256 maxValue, uint256 endTime, uint256 createdAt, uint256 responseCount, bool isActive)',
  'function getPollResponses(uint256 _pollId) external view returns (tuple(address respondent, bytes32 encryptedValue, uint256 submittedAt)[] responses)',
  'function getUserPolls(address _user) external view returns (uint256[])',
  'function getUserResponses(address _user) external view returns (uint256[])',
  'function checkIfResponded(uint256 _pollId, address _user) external view returns (bool)',
  'function getActivePolls(uint256 _limit) external view returns (uint256[])',
  'function closePoll(uint256 _pollId) external',
  'function pollCounter() external view returns (uint256)',
  'event PollCreated(uint256 indexed pollId, address indexed creator, string question, uint256 minValue, uint256 maxValue, uint256 endTime)',
  'event ResponseSubmitted(uint256 indexed pollId, address indexed respondent, bytes32 encryptedValue)',
  'event PollClosed(uint256 indexed pollId, address indexed creator)',
]

type Tab = 'CREATE' | 'MY_POLLS' | 'BROWSE' | 'MY_RESPONSES'

interface Poll {
  id: number
  question: string
  creator: string
  minValue: number
  maxValue: number
  endTime: number
  createdAt: number
  responseCount: number
  isActive: boolean
  hasResponded?: boolean
  myResponse?: number // stored locally so user can see their own answer
}

export default function PrivatePoll() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChain } = useSwitchChain()
  const chainId = useChainId()
  const { data: balance } = useBalance({
    address: address,
    chainId: sepolia.id,
  })
  
  const [activeTab, setActiveTab] = useState<Tab>('BROWSE')
  const [relayerInstance, setRelayerInstance] = useState<any>(null)
  const [isRelayerLoading, setIsRelayerLoading] = useState(false)
  
  // form state for creating polls
  const [question, setQuestion] = useState<string>('')
  const [minValue, setMinValue] = useState<string>('1')
  const [maxValue, setMaxValue] = useState<string>('5')
  const [endDate, setEndDate] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  
  // poll lists
  const [myPolls, setMyPolls] = useState<Poll[]>([])
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [myResponses, setMyResponses] = useState<Poll[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // response modal state
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [responseValue, setResponseValue] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initRelayer()
    }
  }, [])

  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id })
    }
  }, [isConnected, chainId, switchChain])

  useEffect(() => {
    if (isConnected && address) {
      loadMyPolls()
      loadActivePolls()
      loadMyResponses()
    }
  }, [isConnected, address])

  // initialize the FHE relayer so we can encrypt responses
  const initRelayer = async () => {
    setIsRelayerLoading(true)
    try {
      const relayerModule: any = await Promise.race([
        import('@zama-fhe/relayer-sdk/web'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Relayer load timeout')), 10000))
      ])

      const sdkInitialized = await Promise.race([
        relayerModule.initSDK(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 10000))
      ])
      
      if (!sdkInitialized) {
        throw new Error('SDK initialization failed')
      }

      const instance = await Promise.race([
        relayerModule.createInstance(relayerModule.SepoliaConfig),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Instance creation timeout')), 10000))
      ])
      
      setRelayerInstance(instance)
    } catch (error) {
      console.error('Failed to initialize relayer:', error)
    } finally {
      setIsRelayerLoading(false)
    }
  }

  const getEthersSigner = async () => {
    if (walletClient) {
      try {
        return await walletClientToSigner(walletClient)
      } catch (err) {
        console.warn('Wallet client failed, trying fallback:', err)
      }
    }
    return await getSigner()
  }

  // create a new poll
  const createPoll = async () => {
    if (!address || !isConnected || !relayerInstance) return
    
    if (!question.trim()) {
      alert('Please enter a question')
      return
    }
    
    const min = parseInt(minValue)
    const max = parseInt(maxValue)
    
    if (isNaN(min) || isNaN(max) || min >= max) {
      alert('Minimum value must be less than maximum value')
      return
    }
    
    if (!endDate || !endTime) {
      alert('Please select end date and time')
      return
    }
    
    try {
      setIsCreating(true)
      
      // combine date and time into unix timestamp
      const dateTimeString = `${endDate}T${endTime}`
      const endTimestamp = Math.floor(new Date(dateTimeString).getTime() / 1000)
      
      if (endTimestamp <= Math.floor(Date.now() / 1000)) {
        alert('End date must be in the future')
        return
      }
      
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const tx = await contract.createPoll(
        question.trim(),
        min,
        max,
        endTimestamp
      )
      
      await tx.wait()
      
      // clear form
      setQuestion('')
      setMinValue('1')
      setMaxValue('5')
      setEndDate('')
      setEndTime('')
      
      // refresh data
      await loadMyPolls()
      await loadActivePolls()
      
      alert('Poll created successfully!')
      setActiveTab('MY_POLLS')
    } catch (error: any) {
      console.error('Failed to create poll:', error)
      alert(`Failed to create poll: ${error.message || 'Unknown error'}`)
    } finally {
      setIsCreating(false)
    }
  }

  // load polls created by current user
  const loadMyPolls = async () => {
    if (!address || !isConnected) return
    
    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const pollIds = await contract.getUserPolls(address)
      const polls: Poll[] = []
      
      for (const pollId of pollIds) {
        const pollData = await contract.getPoll(pollId)
        
        polls.push({
          id: Number(pollId),
          question: pollData.question,
          creator: pollData.creator,
          minValue: Number(pollData.minValue),
          maxValue: Number(pollData.maxValue),
          endTime: Number(pollData.endTime),
          createdAt: Number(pollData.createdAt),
          responseCount: Number(pollData.responseCount),
          isActive: pollData.isActive,
        })
      }
      
      setMyPolls(polls.reverse())
    } catch (error) {
      console.error('Failed to load polls:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // load all active polls that users can respond to
  const loadActivePolls = async () => {
    if (!address || !isConnected) return
    
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const pollIds = await contract.getActivePolls(50)
      const polls: Poll[] = []
      
      for (const pollId of pollIds) {
        const pollData = await contract.getPoll(pollId)
        const hasResponded = await contract.checkIfResponded(pollId, address)
        
        // check local storage for user's response so we can show it
        const storedResponse = getStoredResponse(pollId)
        
        polls.push({
          id: Number(pollId),
          question: pollData.question,
          creator: pollData.creator,
          minValue: Number(pollData.minValue),
          maxValue: Number(pollData.maxValue),
          endTime: Number(pollData.endTime),
          createdAt: Number(pollData.createdAt),
          responseCount: Number(pollData.responseCount),
          isActive: pollData.isActive,
          hasResponded: hasResponded,
          myResponse: storedResponse,
        })
      }
      
      setActivePolls(polls)
    } catch (error) {
      console.error('Failed to load active polls:', error)
    }
  }

  // load polls that current user has responded to
  const loadMyResponses = async () => {
    if (!address || !isConnected) return
    
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const pollIds = await contract.getUserResponses(address)
      const polls: Poll[] = []
      
      for (const pollId of pollIds) {
        const pollData = await contract.getPoll(pollId)
        const storedResponse = getStoredResponse(pollId)
        
        polls.push({
          id: Number(pollId),
          question: pollData.question,
          creator: pollData.creator,
          minValue: Number(pollData.minValue),
          maxValue: Number(pollData.maxValue),
          endTime: Number(pollData.endTime),
          createdAt: Number(pollData.createdAt),
          responseCount: Number(pollData.responseCount),
          isActive: pollData.isActive,
          hasResponded: true,
          myResponse: storedResponse,
        })
      }
      
      setMyResponses(polls.reverse())
    } catch (error) {
      console.error('Failed to load my responses:', error)
    }
  }

  // save response locally so user can see what they answered
  const storeResponse = (pollId: number, value: number) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`poll_response_${pollId}`, value.toString())
    } catch (e) {
      console.error('Failed to store response:', e)
    }
  }

  // get stored response from local storage
  const getStoredResponse = (pollId: number): number | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
      const stored = localStorage.getItem(`poll_response_${pollId}`)
      return stored ? parseInt(stored) : undefined
    } catch {
      return undefined
    }
  }

  // submit encrypted response to a poll
  const submitResponse = async (poll: Poll, value: number) => {
    if (!address || !isConnected || !relayerInstance) return
    
    if (poll.hasResponded) {
      alert('You have already responded to this poll')
      return
    }
    
    if (value < poll.minValue || value > poll.maxValue) {
      alert(`Value must be between ${poll.minValue} and ${poll.maxValue}`)
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // encrypt the response value using FHE
      const inputBuilder = relayerInstance.createEncryptedInput(
        POLL_CONTRACT_ADDRESS,
        address
      )
      
      inputBuilder.add32(value)
      
      const encryptedInput = await Promise.race([
        inputBuilder.encrypt(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Encryption timeout')), 30000)
        )
      ]) as any
      
      if (!encryptedInput?.handles || encryptedInput.handles.length === 0) {
        throw new Error('Encryption failed')
      }
      
      const encryptedValue = encryptedInput.handles[0]
      const attestation = encryptedInput.inputProof || '0x'
      
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const tx = await contract.submitResponse(
        poll.id,
        encryptedValue,
        attestation
      )
      
      await tx.wait()
      
      // save response locally
      storeResponse(poll.id, value)
      
      // close modal
      setSelectedPoll(null)
      setResponseValue('')
      
      // refresh data
      await loadActivePolls()
      await loadMyResponses()
      
      alert('Response submitted successfully!')
    } catch (error: any) {
      console.error('Failed to submit response:', error)
      alert(`Failed to submit response: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // close a poll (only creator can do this)
  const closePoll = async (pollId: number) => {
    if (!address || !isConnected) return
    
    if (!confirm('Are you sure you want to close this poll?')) return
    
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(POLL_CONTRACT_ADDRESS, POLL_ABI, signer)
      
      const tx = await contract.closePoll(pollId)
      await tx.wait()
      
      await loadMyPolls()
      await loadActivePolls()
      
      alert('Poll closed')
    } catch (error: any) {
      console.error('Failed to close poll:', error)
      alert(`Failed to close poll: ${error.message || 'Unknown error'}`)
    }
  }

  // get minimum date (tomorrow) for date input
  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full border border-gray-200">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📊</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Private Poll
            </h1>
            <p className="text-gray-600">Anonymous polls with FHE encryption</p>
          </div>
          <div className="space-y-4">
            <p className="text-gray-500 text-center text-sm">
              Connect your wallet to create polls and participate
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-indigo-50">
      {/* header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Private Poll
                </h1>
                <p className="text-sm text-gray-500">Fully encrypted anonymous polling</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {balance && (
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                  {parseFloat(formatEther(balance.value)).toFixed(4)} ETH
                </div>
              )}
              <ConnectButton />
            </div>
          </div>
          
          {/* tabs */}
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            {([
              { key: 'BROWSE', label: 'Browse' },
              { key: 'CREATE', label: 'Create' },
              { key: 'MY_POLLS', label: 'My Polls' },
              { key: 'MY_RESPONSES', label: 'My Responses' }
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* create poll */}
        {activeTab === 'CREATE' && (
          <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-3xl">➕</span>
              Create New Poll
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Poll Question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Rate service quality from 1 to 5"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Minimum Value</label>
                  <input
                    type="number"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Maximum Value</label>
                  <input
                    type="number"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={createPoll}
                disabled={isCreating || isRelayerLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg"
              >
                {isCreating ? 'Creating Poll...' : '📊 Create Poll'}
              </button>
            </div>
          </div>
        )}

        {/* browse polls */}
        {activeTab === 'BROWSE' && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-gray-900 mb-5">Active Polls</h2>
            
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading polls...</div>
            ) : activePolls.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
                No active polls available
              </div>
            ) : (
              <div className="grid gap-4">
                {activePolls.map((poll) => (
                  <div
                    key={poll.id}
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-gray-900 font-semibold text-lg mb-2">
                          {poll.question}
                        </div>
                        <div className="text-gray-600 text-sm space-y-1">
                          <div>Range: {poll.minValue} - {poll.maxValue}</div>
                          <div>Responses: <span className="font-medium text-blue-600">{poll.responseCount}</span></div>
                          <div>Ends: {new Date(poll.endTime * 1000).toLocaleString()}</div>
                          {poll.hasResponded && poll.myResponse !== undefined && (
                            <div className="text-blue-600 font-medium mt-2">
                              Your response: {poll.myResponse}
                            </div>
                          )}
                        </div>
                      </div>
                      {!poll.hasResponded && (
                        <button
                          onClick={() => setSelectedPoll(poll)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm whitespace-nowrap ml-4"
                        >
                          Respond
                        </button>
                      )}
                      {poll.hasResponded && (
                        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg whitespace-nowrap ml-4 font-medium">
                          Responded
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* my polls */}
        {activeTab === 'MY_POLLS' && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-gray-900 mb-5">My Polls</h2>
            
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading polls...</div>
            ) : myPolls.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
                You haven't created any polls yet
              </div>
            ) : (
              <div className="grid gap-4">
                {myPolls.map((poll) => (
                  <div
                    key={poll.id}
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-gray-900 font-semibold text-lg mb-2">
                          {poll.question}
                        </div>
                        <div className="text-gray-600 text-sm space-y-1">
                          <div>Range: {poll.minValue} - {poll.maxValue}</div>
                          <div className="text-blue-600 font-semibold">Responses: {poll.responseCount}</div>
                          <div>Created: {new Date(poll.createdAt * 1000).toLocaleString()}</div>
                          <div>Ends: {new Date(poll.endTime * 1000).toLocaleString()}</div>
                          <div className={`mt-2 font-medium ${poll.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {poll.isActive ? '✅ Active' : '❌ Closed'}
                          </div>
                        </div>
                      </div>
                      {poll.isActive && (
                        <button
                          onClick={() => closePoll(poll.id)}
                          className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 whitespace-nowrap ml-4 font-medium"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* my responses */}
        {activeTab === 'MY_RESPONSES' && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-gray-900 mb-5">My Responses</h2>
            
            {myResponses.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
                You haven't responded to any polls yet
              </div>
            ) : (
              <div className="grid gap-4">
                {myResponses.map((poll) => (
                  <div
                    key={poll.id}
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                  >
                    <div className="text-gray-900 font-semibold text-lg mb-2">
                      {poll.question}
                    </div>
                    <div className="text-gray-600 text-sm space-y-1">
                      <div>Range: {poll.minValue} - {poll.maxValue}</div>
                      {poll.myResponse !== undefined && (
                        <div className="text-blue-600 font-semibold text-lg mt-2">
                          Your response: {poll.myResponse}
                        </div>
                      )}
                      <div>Total responses: {poll.responseCount}</div>
                      <div>Ends: {new Date(poll.endTime * 1000).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* response modal */}
      {selectedPoll && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-3">{selectedPoll.question}</h3>
            <p className="text-gray-600 text-sm mb-5">
              Select a value from {selectedPoll.minValue} to {selectedPoll.maxValue}
            </p>
            
            <input
              type="number"
              value={responseValue}
              onChange={(e) => setResponseValue(e.target.value)}
              min={selectedPoll.minValue}
              max={selectedPoll.maxValue}
              placeholder={`${selectedPoll.minValue} - ${selectedPoll.maxValue}`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-5"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedPoll(null)
                  setResponseValue('')
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const value = parseInt(responseValue)
                  if (!isNaN(value)) {
                    submitResponse(selectedPoll, value)
                  } else {
                    alert('Please enter a number')
                  }
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50 font-medium"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
