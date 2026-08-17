I want to double down on the kubernetes example. This is a scheduler problem and I want to take inspiration from a real world scheduler.

## Worker pools

Cluster - Room
Node - Producer Pool
Kubelet - Worker Pool
pod - worker
Control Plan - N/A

In this way each room is it's own cluster. Even if we move creeps to another room the cluster it was born is is the cluster responsible for it's scheduling. The Producer pool allows us to service multiple job producers such as extensions separately, more fine grained control of work force. Then worker pools can be assigned to nodes based on rules similar to taints (ensure specialist join the right "Node" while not excluding generalist who should have all tolerations). Mimic burstiness with scaling pods 

Not a spec, a shape to react to at architecture time:

''' ts
const config = {
    DefaultRoom: {
        spawns: {
            // able to take function that returns number or number
            NumWorkers: fn() num
            Priority: CRITICAL
            Taints: FILLER
        },
        extensions: {
            NumWorkers: 1 * num_extension
            // able to take function that returns Priority ENUM or enum value
            Priority: fn() enum, 
            Taints: FILLER,
            balancer: LEAST_FULL,
        },
        mines: {
            NumWorkers: fn()
            Priority: CRITICAL
            Taints: WORKER,
            balancer: STICKY,
        },
    },
    WarRoom: {...}
}
'''

This takes care of the workforce settings, a critical understanding is that NumWorkers and Priority can be functions allowing for certain conditions and environmental flags to trigger changes. Taints may be unecessary, let me know. JobIds will have pool name in them so no recomputing which workers are in which pool. Another thing to consider is differences in affinity within a node. For Nodes with more than 1 producer the balancer should route to the correct functionality. For example, extensions should be filled by the least full first but miners we want stuck to their first mine forever.

## StageGate

This is more complicated mostly because of my vague definition. It refers to both changes in priority and assigned workers based on environmental pressures and it means the change of our workforce. For changes in priority and assigned workers this can be handled with variables used as inputs to the functions used in the worker pools config such as target populations to switch which function we use to cacluate work force.

For change of our workforce we can do something similar. Where we have a config and business logic decide.

Not a spec, a shape to react to at architecture time:

``` ts
const config = {
    MINER_CONSTANT: 1,
    DESIRED_POP: fn(),
    generalists: {
        pop: generalistsPop(),
        priority: fn()
    },
    miner: {
        pop: miner() number,
        priority: fn()
    },
    hauler: {
        pop: fn() number,
        priority: fn()
    }
}

func generalistsPop() number {
    return DESIRED_POP - (NumContainers * 2)
}

func miner() number {
    if (!NumContainers) return 0

    return NumContainers * MINERCONSTANT
}
```