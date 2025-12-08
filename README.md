# Performance Benchmarking

Performance benchmarking requires using special systems that have been set up for benchmarking purposes. These systems are not readily available in Github, and thus a more complicated workflow has to be employed.


```mermaid
---
config:
  theme: 'base'
  themeVariables:
    primaryColor: '#ffffffff'
    primaryTextColor: '#ffffffff'
    primaryBorderColor: '#76B900'
    lineColor: '#76B900'
    clusterBkg: '#5e5c63'
    clusterBorder: '#76B900'
    mainBkg: '#5e5c63'
    titleColor: '#76B900'
---
flowchart TD
    GitHub[GitHub perf.yml workflow triggered]

    subgraph GitHubRunner["GitHub runner"]
        direction TB
        Workflow["Create branch bot/**WORKFLOW_ID**/perf"]
        Commit["Create commit with image ref: ghcr.io/nvidia/cuda-quantum@sha256:**COMMIT_SHA**"]
        Contents["Create file perf/**COMMIT_SHA** with metadata"]

        Workflow --> Commit --> Contents
    end

    GitHub --> GitHubRunner

    WaitGitLab{Wait for GitLab mirror to sync}

    GitHubRunner --> WaitGitLab

    subgraph GitLabRunner["GitLab runner"]
        direction TB
        Prepare["Read perf commit contents to build job metadata"]
        SSH["SSH into perf runner"]

        Prepare --> SSH
    end

    WaitGitLab --> GitLabRunner

    subgraph PerfRunner["Perf runner"]
        direction TB
        Bash["Start bash script with parameters to queue job"]
        Slurm["Start sbatch job for selected performance test"]
        WaitSlurm{Wait for Slurm job to complete}
        Cleanup["Clean up and verify performance run"]
        Finalize["Transfer data to data repository"]

        Bash --> Slurm --> WaitSlurm --> Cleanup --> Finalize
    end

    GitLabRunner --> PerfRunner

    Database[(Database)]
    Visualize["How do we want to visualize data? Grafana / Power BI / etc."]

    PerfRunner --> Database --> Visualize
```

The contents of the file `perf/COMMIT_SHA` in the commit will be:
```yaml
source-sha: 9db48592d03ea7478b20d8785447b02411c68de3
cuda-quantum-image: nvcr.io/nvidia/nightly/cuda-quantum@sha256:1b66c98db7cf9f1bdc1376d96ae42308316dd748695898efcf54a0190c7b3292
platforms: linux/amd64,linux/arm64
GPU: GH200,B200 # Options: A100,GH200,B200,H100,ALL
GPUs: 1 # Options, 1, 4, 8
```
