window.addEventListener('DOMContentLoaded', function() {
    $('#update').click(function() {
        if(confirm("Do you want to rebuild this graph with new Facebook data?")) {
            localStorage.clear();
            window.location.reload();
        }
    });
    //When node hovered
    var updateFriendInfo = function(friend) {
        //compatible with both normal browser and nw-utility.js
        var hackishHref = 'javascript:window.open("' + 'https://facebook.com/' + friend.id + '", "_blank")';
        $('#friend-info a').attr('href', hackishHref).text(friend.name);
        $('#friend-info img').attr('src', friend.thumbnailUrl);
    };
    //When node clicked
    var openProfileInTab = function(id) {
        window.open('https://facebook.com/' + id, '_blank');
    }


    //graph: Initializes a graph on #graph and returns addFriends and addFriendships
    //friend object: {name, id, thumbnailUrl}
    //friendship string: id1 + '/' + id2 where id1 > id2
    //sigma implementation requires layout.forceAtlas2 plugin
    var sigmaGraph = function(sigma) {
        var s = new sigma({
            renderer: {
                type: 'canvas',
                container: document.getElementById('graph')
            },
            settings: {
                defaultNodeColor: '#ec5148',
                defaultEdgeColor: '#999',
                edgeColor: 'default'
            }
        });
        s.bind('overNode', function(e) { updateFriendInfo(e.data.node.friend); });
        s.bind('clickNode', function(e) { openProfileInTab(e.data.node.id); });

        return {
            addFriends: function(friends) {
                friends.forEach(function(friend) {
                    s.graph.addNode({
                        id: friend.id,
                        friend: friend,
                        size: 1,
                        r: 1,
                        x: 1000 * Math.random(),
                        y: 1000 * Math.random()
                    });
                });
                s.refresh();
            },
            addFriendships: function(friendships) {
                friendships.forEach(function(friendship) {
                    var ids = friendship.split('/')
                    s.graph.addEdge({
                        source: ids[0],
                        target: ids[1],
                        id: friendship
                    });
                });

                //parameters: http://git.io/vLwO1
                s.configForceAtlas2({
                    outboundAttractionDistribution: true,
                    gravity: 0.1,
                    barnesHutTheta: 1
                });
                s.startForceAtlas2();
                setTimeout(s.killForceAtlas2.bind(s), 6000);
                s.refresh()
            }
        };
    };

    var jsnxGraph = function(jsnx, d3) {
        var graph = window.G = new jsnx.Graph();
        //As of JSNetworkX v0.3.3, OptBind option (draw as you add) crashes JSNetworkx if you add too many features at the same time
        var drawAndBindEvents = function() {
            var forceLayout = jsnx.draw(graph, {
                element: '#graph',
                d3: d3,
                nodeAttr: {
                    class: 'node',
                    r: 4
                },
                nodeStyle: {
                    fill: '#ff7f0e',
                    stroke: 'none'
                },
                edgeStyle: {
                    fill: '#999'
                }
            }, false);
            setTimeout(forceLayout.stop, 20000);

            d3.selectAll('.node')
                .on('click', function(d) { openProfileInTab(d.data.id); })
                .on('mouseover', function(d) { updateFriendInfo(d.data); });
        };

        return {
            addFriends: function(friends) {
                var nodes = friends.map(function(friend) { 
                    return [friend.id, friend];
                });
                graph.addNodesFrom(nodes);
                drawAndBindEvents();
            },
            addFriendships: function(friendships) {
                var edges = friendships.map(function(friendship) { 
                    return friendship.split('/');
                });
                graph.addEdgesFrom(edges);
                drawAndBindEvents();
            }
        };
    };

    if(window.sigma) var graph =  sigmaGraph(sigma);
    else if(window.jsnx && window.d3) var graph = jsnxGraph(jsnx, d3);
    else throw('Requires either Sigma.js with ForceAtlas2 plugin or JSNetworX with D3')


    var facebook = (function($) {
        var cache = localStorage.cache ? JSON.parse(localStorage.cache) : {mutualFriendsIdsOf: {}};
        var saveCache = function() {
            localStorage.cache = JSON.stringify(cache);
        };

        //returns friend objects array from friends list page html
        var parseFriendsListPage = function(html) {
            return $(html).find('#root table').map(function() {
                var table = $(this); //Yeah $.map is weird...
                var link = table.find('a'), href = link.attr('href'), image = table.find('img');
                if(image.length == 0) return;
                return {
                    name: link.text(),
                    id: href.startsWith('/profile.php') ? parseInt(href.split('id=')[1]) : href.substring(1).split('?')[0],
                    thumbnailUrl: image.attr('src')
                };
            }).get();
        };

        //Fetches all friends list pages
        //Returns promise resolved with friend objects array
        var fetchFriendsList = function(firstPageUrl) {
            var deferred = $.Deferred();

            $.get(firstPageUrl, function(html) {
                var matches = html.match(/Friends \((\d+)\)/);
                var numberOfFriends = matches ? parseInt(html.match(/Friends \((\d+)\)/)[1]) : 0;
                promises = [$.when([html])];
                //24 friends on the first page, 36 on every following page...
                for(startIndex = 24; startIndex < numberOfFriends; startIndex += 36)
                    promises.push($.get(firstPageUrl + '&startindex=' + startIndex));
                //jQuery really needs a $.all helper...
                $.when.apply(this, promises).done(function() {
                    var pagesHtml = Array.prototype.slice.call(arguments).map(function(args) {
                        return args[0];
                    });
                    deferred.resolve($.map(pagesHtml, parseFriendsListPage));
                });
            });

            return deferred.promise();
        };

        return {
            //Gets the user's profile page then, if authenticated, the user's friend list
            fetchFriends: function() {
                var deferred = $.Deferred();

                if(cache.friends) deferred.resolve(cache.friends);
                else $.get('http://m.facebook.com/me').then(function(html) {
                    var friendsListHref = $(html).find('#m-timeline-cover-section a[href*="friends"]').attr('href');
                    var url = 'https://m.facebook.com' + friendsListHref;
                    if(friendsListHref)
                        fetchFriendsList(url).then(function(friends) { 
                            cache.friends = friends;
                            saveCache();
                            deferred.resolve(friends)
                        });
                    else
                        deferred.reject('Please login to Facebook');
                }, function() {
                    deferred.reject('Same origin policy enabled');
                });
                
                return deferred.promise();
            },
            //Doesn't handle errors
            fetchMutualFriendsIdsOf: function(friend) {
                var deferred = $.Deferred();

                if(cache.mutualFriendsIdsOf[friend.id])
                    deferred.resolve(cache.mutualFriendsIdsOf[friend.id]);
                else {
                    if(typeof friend.id === 'number')
                      var url = 'https://m.facebook.com/profile.php?id=' + friend.id + '&v=friends&mutual=1';
                    else
                      var url = 'https://m.facebook.com/' + friend.id + '?v=friends&mutual=1';
                    fetchFriendsList(url).then(function(mutualFriends) {
                        mutualFriendsIds = mutualFriends.map(function(f) {return f.id});
                        cache.mutualFriendsIdsOf[friend.id] = mutualFriendsIds;
                        saveCache();
                        deferred.resolve(mutualFriendsIds);
                    });
                }

                return deferred.promise();
            }
        };
    })(jQuery);

    facebook.fetchFriends().then(function(friends) {
        graph.addFriends(friends);
        var friendships = [], fetched = 0, i = 0, progressBar = document.getElementById('progress-bar');
        friends.forEach(function(friend) {
            setTimeout(function() {
                facebook.fetchMutualFriendsIdsOf(friend).then(function(mutualFriendsIds) {
                    for(var i = 0; i < mutualFriendsIds.length; i++) {
                        var friendship = [friend.id, mutualFriendsIds[i]].sort().join('/');
                        if(friendships.indexOf(friendship) == -1) friendships.push(friendship);
                    }
                    fetched += 1;
                    progressBar.style.width = Math.round(100 * fetched / friends.length) + '%';
                    if(fetched == friends.length) {
                        graph.addFriendships(friendships);
                        progressBar.remove();
                    }
                });
            }, 5 * i++);
        });
    }, function(message) {
        var loginUrl = 'https://m.facebook.com/login';
        document.body.innerHTML = "<iframe id='iframe' src='"+loginUrl+"' width='100%' height='600px'></iframe>";
        var iframe = document.getElementById("iframe");
        setInterval(function() {
            if(! iframe.contentWindow.location.href.startswith(loginUrl)) location.reload();
        }, 500);
    });
});
